import { createRoot } from 'react-dom/client';
import {
  Action,
  ActionsRegistry,
  getExtendedActionState,
  getExtendedInterstitialState,
  getExtendedWebsiteState,
  type ActionAdapter,
  type ActionCallbacksConfig,
} from '../api';
import { ActionConfig } from '../api/ActionConfig';
import { checkSecurity, type SecurityLevel } from '../shared';
import { ActionContainer, type StylePreset } from '../ui';
import { noop } from '../utils/constants';
import { isInterstitial } from '../utils/interstitial-url';
import { proxify } from '../utils/proxify';
import { ActionsURLMapper, type ActionsJsonConfig } from '../utils/url-mapper';
type ObserverSecurityLevel = SecurityLevel;
export interface ObserverOptions {
  // trusted > unknown > malicious
  securityLevel:
    | ObserverSecurityLevel
    | Record<'websites' | 'interstitials' | 'actions', ObserverSecurityLevel>;
}

interface NormalizedObserverOptions {
  securityLevel: Record<
    'websites' | 'interstitials' | 'actions',
    ObserverSecurityLevel
  >;
}

const DEFAULT_OPTIONS: ObserverOptions = {
  securityLevel: 'only-trusted',
};
console.log('loaded');
const normalizeOptions = (
  options: Partial<ObserverOptions>,
): NormalizedObserverOptions => {
  return {
    ...DEFAULT_OPTIONS,
    ...options,
    securityLevel: (() => {
      if (!options.securityLevel) {
        return {
          websites: DEFAULT_OPTIONS.securityLevel as ObserverSecurityLevel,
          interstitials: DEFAULT_OPTIONS.securityLevel as ObserverSecurityLevel,
          actions: DEFAULT_OPTIONS.securityLevel as ObserverSecurityLevel,
        };
      }

      if (typeof options.securityLevel === 'string') {
        return {
          websites: options.securityLevel,
          interstitials: options.securityLevel,
          actions: options.securityLevel,
        };
      }

      return options.securityLevel;
    })(),
  };
};
let pageScriptLoaded = false;
let connectedAddress: string | null = null;
const options: ObserverOptions = {
  securityLevel: 'only-trusted', // TODO: Should support only-trusted or non-malicious
};
const actionConfig = new ActionConfig(
  'https://tammi-n3hltb-fast-mainnet.helius-rpc.com/',
  {
    connect: async () => {
      window.postMessage({ type: 'CONNECT_WALLET_SOLANA' }, '*');
      console.log('posted message', { type: 'CONNECT_WALLET_SOLANA' });
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          console.log('called timeout');
          reject(new Error('Wallet connection timed out'));
        }, 30000); // 30 second timeout

        window.addEventListener('message', function handler(event) {
          if (event.data.type === 'WALLET_CONNECTED_SOLANA') {
            clearTimeout(timeout);
            window.removeEventListener('message', handler);
            resolve(event.data.account);
          } else if (event.data.type === 'WALLET_CONNECTION_ERROR_SOLANA') {
            clearTimeout(timeout);
            window.removeEventListener('message', handler);
            reject(new Error(event.data.error));
          }
        });
      });
    },
    async signTransaction(
      tx: string,
    ): Promise<{ signature: string } | { error: string }> {
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Transaction signing timed out'));
        }, 60000); // 60 second timeout

        const handler = (event: MessageEvent) => {
          if (event.data.type === 'TRANSACTION_SIGNED_SOLANA') {
            clearTimeout(timeout);
            window.removeEventListener('message', handler);
            resolve({ signature: event.data.signature });
          } else if (event.data.type === 'TRANSACTION_SIGN_ERROR_SOLANA') {
            clearTimeout(timeout);
            window.removeEventListener('message', handler);
            reject(new Error(event.data.error));
          }
        };

        window.addEventListener('message', handler);

        window.postMessage(
          {
            type: 'SIGN_TRANSACTION_SOLANA',
            transaction: tx,
          },
          '*',
        );
      });
    },
    // async confirmTransaction(signature: string) {
    //   return Promise.resolve();
    // },
  },
);
export function setupTwitterObserver(
  config: ActionAdapter,
  callbacks: Partial<ActionCallbacksConfig> = {},
  options: Partial<ObserverOptions> = DEFAULT_OPTIONS,
) {
  const mergedOptions = normalizeOptions(options);
  const twitterReactRoot = document.getElementById('react-root')!;
  console.log('setup');
  const refreshRegistry = async () => {
    await ActionsRegistry.getInstance().init();

    setTimeout(refreshRegistry, 1000 * 60 * 10); // every 10 minutes
  };

  // if we don't have the registry, then we don't show anything
  refreshRegistry().then(() => {
    // entrypoint
    console.log('registry');
    const observer = new MutationObserver((mutations) => {
      console.log('mutations', mutations);
      // it's fast to iterate like this
      for (let i = 0; i < mutations.length; i++) {
        const mutation = mutations[i];
        for (let j = 0; j < mutation.addedNodes.length; j++) {
          const node = mutation.addedNodes[j];
          if (node.nodeType !== Node.ELEMENT_NODE) {
            console.log(
              node.nodeType,
              Node.ELEMENT_NODE,
              node.nodeType !== Node.ELEMENT_NODE,
              'nodetype',
            );
            return;
          }
          handleNewNode(
            node as Element,
            config,
            callbacks,
            mergedOptions,
            i,
            j,
          ).catch(noop);
        }
      }
    });
    console.log(twitterReactRoot, 'reactroot');
    if (twitterReactRoot)
      observer.observe(twitterReactRoot, { childList: true, subtree: true });
  });
}

// setTimeout(() => {
setupTwitterObserver(actionConfig, {}, options);
// }, 4000);

async function handleNewNode(
  node: Element,
  config: ActionAdapter,
  callbacks: Partial<ActionCallbacksConfig>,
  options: NormalizedObserverOptions,
  i: number,
  j: number,
) {
  console.log('handlenewnode', config);
  const element = node as Element;
  // first quick filtration
  if (!element || element.localName !== 'div') {
    return;
  }
  const rootElement = findElementByTestId(element, 'card.wrapper');
  console.log(rootElement, 'rootelement', i, j);
  if (!rootElement) {
    return;
  }
  // handle link preview only, assuming that link preview is a must for actions
  const linkPreview = rootElement.children[0] as HTMLDivElement;
  console.log(linkPreview, 'linkpreview');
  if (!linkPreview) {
    return;
  }

  const anchor = linkPreview.children[0] as HTMLAnchorElement;
  const shortenedUrl = anchor.href;
  const actionUrl = await resolveTwitterShortenedUrl(shortenedUrl);
  const interstitialData = isInterstitial(actionUrl);
  console.log(interstitialData, actionUrl, 'interstitialdata');

  if (
    // @ts-ignore
    !interstitialData.decodedActionUrl.startsWith(
      'https://api2.blockend.com/v1/actions/',
    )
  ) {
    return;
  }
  let actionApiUrl: string | null;

  if (interstitialData.isInterstitial) {
    const interstitialState = getExtendedInterstitialState(
      actionUrl.toString(),
    );
    console.log(
      interstitialData,
      !checkSecurity(interstitialState, options.securityLevel.interstitials),
      'interstitialdata',
    );
    if (
      !checkSecurity(interstitialState, options.securityLevel.interstitials)
    ) {
      return;
    }

    actionApiUrl = interstitialData.decodedActionUrl;
  } else {
    const websiteState = getExtendedWebsiteState(actionUrl.toString());
    console.log(
      websiteState,
      !checkSecurity(websiteState, options.securityLevel.websites),
      actionUrl,
      'websitestate',
    );

    if (!checkSecurity(websiteState, options.securityLevel.websites)) {
      return;
    }
    const actionsJsonUrl = actionUrl.origin + '/actions.json';
    console.log(actionsJsonUrl, 'jsonurlelse');
    const actionsJson = await fetch(proxify(actionsJsonUrl)).then(
      (res) => res.json() as Promise<ActionsJsonConfig>,
    );

    const actionsUrlMapper = new ActionsURLMapper(actionsJson);

    actionApiUrl = actionsUrlMapper.mapUrl(actionUrl);
  }

  const state = actionApiUrl ? getExtendedActionState(actionApiUrl) : null;
  console.log(actionApiUrl, state, 'jsonurlif');
  if (
    !actionApiUrl ||
    !state ||
    !checkSecurity(state, options.securityLevel.actions)
  ) {
    return;
  }
  console.log(actionApiUrl, 'actionapiurl');
  let action;
  if (actionApiUrl?.includes('/actions/portfolio')) {
    // @ts-ignore
    let account = await config.adapter.connect();
    console.log(account, 'accountadaptor');
    let url = `${actionApiUrl}?account=${account}`;
    action = await Action.fetch(url, config);
  } else {
    action = await Action.fetch(actionApiUrl, config);
  }
  console.log(action, 'actionjsonres');
  if (!action) {
    console.log(action, 'returned');
    return;
  }
  console.log(
    rootElement.parentElement,
    `actionurl:${actionUrl},action:${action},callbacks:${callbacks},options:${options},isinterstitial:${interstitialData.isInterstitial}`,
    'parentelement',
  );
  rootElement.parentElement?.replaceChildren(
    createAction({
      originalUrl: actionUrl,
      action,
      callbacks,
      options,
      isInterstitial: interstitialData.isInterstitial,
    }),
  );
}

function createAction({
  originalUrl,
  action,
  callbacks,
  options,
}: {
  originalUrl: URL;
  action: Action;
  callbacks: Partial<ActionCallbacksConfig>;
  options: NormalizedObserverOptions;
  isInterstitial: boolean;
}) {
  const container = document.createElement('div');
  container.className = 'dialect-action-root-container';

  const actionRoot = createRoot(container);
  console.log(
    action,
    callbacks,
    options,
    originalUrl,
    actionRoot,
    container,
    createRoot,
    'createaction',
  );
  actionRoot.render(
    <ActionContainer
      stylePreset={resolveXStylePreset()}
      action={action}
      websiteUrl={originalUrl.toString()}
      websiteText={originalUrl.hostname}
      callbacks={callbacks}
      securityLevel={options.securityLevel}
    />,
  );

  return container;
}

const resolveXStylePreset = (): StylePreset => {
  const colorScheme = document.querySelector('html')?.style.colorScheme;

  if (colorScheme) {
    return colorScheme === 'dark' ? 'x-dark' : 'x-light';
  }

  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  return prefersDark ? 'x-dark' : 'x-light';
};

async function resolveTwitterShortenedUrl(shortenedUrl: string): Promise<URL> {
  const res = await fetch(shortenedUrl);
  const html = await res.text();
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const actionUrl = doc.querySelector('title')?.textContent;
  console.log(html, parser, doc, actionUrl, new URL(actionUrl!), 'resolvets');
  return new URL(actionUrl!);
}

function findElementByTestId(element: Element, testId: string) {
  if (element.attributes.getNamedItem('data-testid')?.value === testId) {
    return element;
  }
  return element.querySelector(`[data-testid="${testId}"]`);
}
