// @ts-nocheck
import {
  PublicKey,
  Transaction,
  TransactionInstruction,
  VersionedTransaction,
} from '@solana/web3.js';
import bs58 from 'bs58';
import { useEffect, useMemo, useReducer, useState } from 'react';
import {
  Action,
  ActionComponent,
  getExtendedActionState,
  getExtendedInterstitialState,
  getExtendedWebsiteState,
  mergeActionStates,
  type ActionCallbacksConfig,
  type ActionContext,
  type ExtendedActionState,
  type Parameter,
} from '../api';
import { checkSecurity, type SecurityLevel } from '../shared';
import { isInterstitial } from '../utils/interstitial-url';
import {
  isPostRequestError,
  isSignTransactionError,
} from '../utils/type-guards';
import type { ButtonProps, StylePreset } from './ActionLayout';
import { ActionLayout } from './ActionLayout';
import { Snackbar } from './Snackbar';
type ExecutionStatus = 'blocked' | 'idle' | 'executing' | 'success' | 'error';

interface ExecutionState {
  status: ExecutionStatus;
  executingAction?: ActionComponent | null;
  errorMessage?: string | null;
  successMessage?: string | null;
}

enum ExecutionType {
  INITIATE = 'INITIATE',
  FINISH = 'FINISH',
  FAIL = 'FAIL',
  RESET = 'RESET',
  SOFT_RESET = 'SOFT_RESET',
  UNBLOCK = 'UNBLOCK',
  BLOCK = 'BLOCK',
}

type ActionValue =
  | {
      type: ExecutionType.INITIATE;
      executingAction: ActionComponent;
      errorMessage?: string;
    }
  | {
      type: ExecutionType.FINISH;
      successMessage?: string | null;
    }
  | {
      type: ExecutionType.FAIL;
      errorMessage: string;
    }
  | {
      type: ExecutionType.RESET;
    }
  | {
      type: ExecutionType.UNBLOCK;
    }
  | {
      type: ExecutionType.BLOCK;
    }
  | {
      type: ExecutionType.SOFT_RESET;
      errorMessage?: string;
    };

const executionReducer = (
  state: ExecutionState,
  action: ActionValue,
): ExecutionState => {
  switch (action.type) {
    case ExecutionType.INITIATE:
      return { status: 'executing', executingAction: action.executingAction };
    case ExecutionType.FINISH:
      return {
        ...state,
        status: 'success',
        successMessage: action.successMessage,
        errorMessage: null,
      };
    case ExecutionType.FAIL:
      return {
        ...state,
        status: 'error',
        errorMessage: action.errorMessage,
        successMessage: null,
      };
    case ExecutionType.RESET:
      return {
        status: 'idle',
      };
    case ExecutionType.SOFT_RESET:
      return {
        ...state,
        status: 'idle',
        errorMessage: action.errorMessage,
        successMessage: null,
      };
    case ExecutionType.BLOCK:
      return {
        status: 'blocked',
      };
    case ExecutionType.UNBLOCK:
      return {
        status: 'idle',
      };
  }
};

const buttonVariantMap: Record<
  ExecutionStatus,
  'default' | 'error' | 'success'
> = {
  blocked: 'default',
  idle: 'default',
  executing: 'default',
  success: 'success',
  error: 'error',
};

const buttonLabelMap: Record<ExecutionStatus, string | null> = {
  blocked: null,
  idle: null,
  executing: 'Executing',
  success: 'Completed',
  error: 'Failed',
};

type ActionStateWithOrigin =
  | {
      action: ExtendedActionState;
      origin?: never;
    }
  | {
      action: ExtendedActionState;
      origin: ExtendedActionState;
      originType: Source;
    };

const getOverallActionState = (
  action: Action,
  websiteUrl?: string | null,
): ActionStateWithOrigin => {
  const actionState = getExtendedActionState(action);
  const originalUrlData = websiteUrl ? isInterstitial(websiteUrl) : null;

  if (!originalUrlData) {
    return {
      action: actionState,
    };
  }

  if (originalUrlData.isInterstitial) {
    return {
      action: actionState,
      origin: getExtendedInterstitialState(websiteUrl!),
      originType: 'interstitials' as Source,
    };
  }

  return {
    action: actionState,
    origin: getExtendedWebsiteState(websiteUrl!),
    originType: 'websites' as Source,
  };
};

const checkSecurityFromActionState = (
  state: ActionStateWithOrigin,
  normalizedSecurityLevel: NormalizedSecurityLevel,
): boolean => {
  return checkSecurity(state.action, normalizedSecurityLevel.actions) &&
    state.origin
    ? checkSecurity(state.origin, normalizedSecurityLevel[state.originType])
    : true;
};

const SOFT_LIMIT_BUTTONS = 10;
const SOFT_LIMIT_INPUTS = 3;
const SOFT_LIMIT_FORM_INPUTS = 10;

const DEFAULT_SECURITY_LEVEL: SecurityLevel = 'only-trusted';

type Source = 'websites' | 'interstitials' | 'actions';
type NormalizedSecurityLevel = Record<Source, SecurityLevel>;

export const ActionContainer = ({
  action,
  websiteUrl,
  websiteText,
  callbacks,
  securityLevel = DEFAULT_SECURITY_LEVEL,
  stylePreset = 'default',
  Experimental__ActionLayout = ActionLayout,
}: {
  action: Action;
  websiteUrl?: string | null;
  websiteText?: string | null;
  callbacks?: Partial<ActionCallbacksConfig>;
  securityLevel?: SecurityLevel | NormalizedSecurityLevel;
  stylePreset?: StylePreset;

  // please do not use it yet, better api is coming..
  Experimental__ActionLayout?: typeof ActionLayout;
}) => {
  console.log(
    action,
    websiteText,
    websiteUrl,
    callbacks,
    securityLevel,
    stylePreset,
    Experimental__ActionLayout,
    'actioncontainer',
  );
  const normalizedSecurityLevel: NormalizedSecurityLevel = useMemo(() => {
    if (typeof securityLevel === 'string') {
      return {
        websites: securityLevel,
        interstitials: securityLevel,
        actions: securityLevel,
      };
    }

    return securityLevel;
  }, [securityLevel]);

  const [actionState, setActionState] = useState(
    getOverallActionState(action, websiteUrl),
  );
  const overallState = useMemo(
    () =>
      mergeActionStates(
        ...([actionState.action, actionState.origin].filter(
          Boolean,
        ) as ExtendedActionState[]),
      ),
    [actionState],
  );

  // adding ui check as well, to make sure, that on runtime registry lookups, we are not allowing the action to be executed
  const isPassingSecurityCheck = checkSecurityFromActionState(
    actionState,
    normalizedSecurityLevel,
  );

  const [executionState, dispatch] = useReducer(executionReducer, {
    status:
      overallState !== 'malicious' && isPassingSecurityCheck
        ? 'idle'
        : 'blocked',
  });

  useEffect(() => {
    callbacks?.onActionMount?.(
      action,
      websiteUrl ?? action.url,
      actionState.action,
    );
    // we ignore changes to `actionState.action` explicitly, since we want this to run once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callbacks, action, websiteUrl]);
  console.log(executionState, action, 'execution state');
  const buttons = useMemo(
    () =>
      action?.actions
        .filter((it) => !it.parameter)
        .filter((it) =>
          executionState.executingAction
            ? executionState.executingAction === it
            : true,
        )
        .toSpliced(SOFT_LIMIT_BUTTONS) ?? [],
    [action, executionState.executingAction],
  );
  const inputs = useMemo(
    () =>
      action?.actions
        .filter((it) => it.parameters.length === 1)
        .filter((it) =>
          executionState.executingAction
            ? executionState.executingAction === it
            : true,
        )
        .toSpliced(SOFT_LIMIT_INPUTS) ?? [],
    [action, executionState.executingAction],
  );
  const form = useMemo(() => {
    const [formComponent] =
      action?.actions
        .filter((it) => it.parameters.length > 1)
        .filter((it) =>
          executionState.executingAction
            ? executionState.executingAction === it
            : true,
        ) ?? [];

    return formComponent;
  }, [action, executionState.executingAction]);
  console.log(buttons, inputs, form, action, 'elements');
  async function handleSwap(payload: any) {
    return await fetch(
      'https://solstation.blockend.com/api/buildWhirlpoolsSwap',
      {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );
  }
  const execute = async (
    component: ActionComponent,
    params?: Record<string, string>,
  ) => {
    if (component.parameters && params) {
      Object.entries(params).forEach(([name, value]) =>
        component.setValue(value, name),
      );
    }
    const newActionState = getOverallActionState(action, websiteUrl);
    const newIsPassingSecurityCheck = checkSecurityFromActionState(
      newActionState,
      normalizedSecurityLevel,
    );
    console.log(
      component,
      action,
      websiteUrl,
      newActionState,
      actionState,
      newIsPassingSecurityCheck,
      params,
      'execute',
    );
    // if action state has changed or origin's state has changed, and it doesn't pass the security check or became malicious, block the action
    if (
      (newActionState.action !== actionState.action ||
        newActionState.origin !== actionState.origin) &&
      !newIsPassingSecurityCheck
    ) {
      setActionState(newActionState);
      dispatch({ type: ExecutionType.BLOCK });
      return;
    }

    dispatch({ type: ExecutionType.INITIATE, executingAction: component });

    const context: ActionContext = {
      action: component.parent,
      actionType: actionState.action,
      originalUrl: websiteUrl ?? component.parent.url,
      triggeredLinkedAction: component,
    };
    console.log(context, action.adapter.connect, 'context');
    try {
      const account = await action.adapter.connect(context);
      console.log(account, 'called connect');
      if (!account) {
        dispatch({ type: ExecutionType.RESET });
        return;
      }

      // const tx = await component
      //   .post(account)
      //   .catch((e: Error) => ({ error: e.message }));
      console.log(
        action?._url,
        action?._url.includes('actions/refuel'),
        action?._url.includes('actions/action'),
        'isinclude',
      );
      if (
        action?._url.includes('actions/refuel') ||
        action?._url.includes('actions/action')
      ) {
        let payload = {
          user: account,
          slippingTolerance: 0.5,
          amount: Number(params?.amount || '0') * 1000000,
          sourceMint: params.sourceMint,
        };
        console.log(payload, 'payload');
        function isVersionedTransaction(transaction) {
          return transaction instanceof VersionedTransaction;
        }
        function convertBase58ToVersionedTransaction(base58String) {
          // Decode the base58 string to a Uint8Array
          const transactionBuffer = bs58.decode(base58String);
          console.log(
            transactionBuffer,
            'transactionBuffer',
            Transaction,
            Transaction.isVersionedTransaction,
          );
          //   let base64 = Buffer.from(transactionBuffer).toString('base64');
          //   console.log(base64, 'base64');
          //   return base64;
          // Check if the transaction is legacy or versioned
          const isVersioned = isVersionedTransaction(transactionBuffer);
          console.log(isVersioned, 'isVersioned');

          let transaction;
          if (isVersioned) {
            //   If it's a versioned transaction, deserialize it as such
            transaction = VersionedTransaction.deserialize(transactionBuffer);
          } else {
            // If it's a legacy transaction, first deserialize it as a legacy transaction
            const legacyTransaction = Transaction.from(transactionBuffer);
            transaction = legacyTransaction;
            // Then convert it to a versioned transaction
            // transaction = new VersionedTransaction(legacyTransaction.compileMessage());
            // console.log(legacyTransaction, transaction, 'legacytxn');
          }

          return transaction;
        }
        const res = await handleSwap(payload)
          .then((res) => res.json())
          .catch((e: Error) => ({
            error: e.message,
          }));
        const tx = res.transaction;
        let txn = convertBase58ToVersionedTransaction(tx);
        console.log(tx, txn, 'tx');

        if (isPostRequestError(tx)) {
          dispatch({
            type: ExecutionType.SOFT_RESET,
            errorMessage: tx.error,
          });
          return;
        }
        console.log(res, 'buildwhirlpool');
        const signResult = await action.adapter.signTransaction(res, context);
        console.log(
          signResult.signature,
          signResult.signature._json,
          'sign result',
        );
        let accountKey = new PublicKey(account);
        console.log(
          txn.recentBlockhash,
          signResult.signature.recentBlockhash,
          'recentBlockhash',
        );
        // const newTxn = new Transaction(signResult.signature._json);
        const _json = signResult.signature._json;
        const instruction = [];
        for (const i of _json.instructions) {
          const keys = i.keys.map((k: any) => {
            return {
              pubkey: new PublicKey(k.pubkey),
              isSigner: k.isSigner,
              isWritable: k.isWritable,
            };
          });

          instruction.push(
            new TransactionInstruction({
              programId: new PublicKey(i.programId),
              data: Buffer.from(i.data),
              keys,
            }),
          );
        }

        const newTxn = new Transaction();
        newTxn.recentBlockhash = _json.recentBlockhash;
        newTxn.feePayer = new PublicKey(_json.feePayer);
        newTxn.add(...instruction);
        // txn.recentBlockhash = signResult.signature.recentBlockhash;
        console.log(newTxn, 'beforesignature');
        newTxn.addSignature(
          accountKey,
          signResult.signature.signatures[1].signature,
        );

        console.log(newTxn, 'newtxn');
        const payloadSend: { messageToken?: string; transaction: string } = {
          messageToken: res.messageToken,
          transaction: bs58.encode(
            newTxn.serialize({
              requireAllSignatures: false,
            }),
          ),
        };
        let sendWhirlpool = await fetch(
          'https://solstation.blockend.com/api/sendWhirlpoolsSwap',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(payloadSend),
          },
        );

        let responseWhirlpool = await sendWhirlpool.json();
        console.log(responseWhirlpool, 'sendWhirlpool');
        const txnResult = responseWhirlpool.signature;
        if (!txnResult || isSignTransactionError({ signature: txnResult })) {
          dispatch({
            type: ExecutionType.FINISH,
            successMessage: responseWhirlpool.message,
          });
        } else {
          await action.adapter.confirmTransaction(txnResult, context);
          dispatch({
            type: ExecutionType.FINISH,
            successMessage: 'Transaction confirmed!',
          });
        }
      } else if (action?._url.includes('/actions/swap')) {
        console.log('execute swap');
        const tx = await fetch(
          `https://actions.dialect.to/api/jupiter/swap/${params.coinSymbol}-${params.opCoinSymbol}/${params.amount}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ account }),
          },
        ).catch((e: Error) => ({ error: e.message }));
        const txBody = await tx.json();
        console.log(txBody, 'txswap');
        if (isPostRequestError(tx)) {
          dispatch({
            type: ExecutionType.SOFT_RESET,
            errorMessage: tx.error,
          });
          return;
        }

        const signResult = await action.adapter.signTransaction(
          { transaction: txBody.transaction, type: 'jup' },
          context,
        );
        console.log(signResult, 'signresulswap');
        if (!signResult || isSignTransactionError(signResult)) {
          dispatch({ type: ExecutionType.RESET });
        } else {
          await action.adapter.confirmTransaction(
            signResult.signature,
            context,
          );
          dispatch({
            type: ExecutionType.FINISH,
            successMessage: tx.message,
          });
        }
      }
    } catch (e) {
      dispatch({
        type: ExecutionType.FAIL,
        errorMessage: (e as Error).message ?? 'Unknown error',
      });
    }
  };

  const asButtonProps = (it: ActionComponent): ButtonProps => ({
    text: buttonLabelMap[executionState.status] ?? it.label,
    loading:
      executionState.status === 'executing' &&
      it === executionState.executingAction,
    disabled: action.disabled || executionState.status !== 'idle',
    variant: buttonVariantMap[executionState.status],
    onClick: (params?: Record<string, string>) => execute(it, params),
  });

  const asInputProps = (it: ActionComponent, parameter?: Parameter) => {
    const placeholder = !parameter ? it.parameter!.label : parameter.label;
    const name = !parameter ? it.parameter!.name : parameter.name;
    const required = !parameter ? it.parameter!.required : parameter.required;

    return {
      // since we already filter this, we can safely assume that parameter is not null
      placeholder,
      disabled: action.disabled || executionState.status !== 'idle',
      name,
      required,
      button: !parameter ? asButtonProps(it) : undefined,
    };
  };

  const asFormProps = (it: ActionComponent) => {
    return {
      button: asButtonProps(it),
      inputs: it.parameters
        .toSpliced(SOFT_LIMIT_FORM_INPUTS)
        .map((parameter) => asInputProps(it, parameter)),
    };
  };

  const disclaimer = useMemo(() => {
    if (overallState === 'malicious' && executionState.status === 'blocked') {
      return (
        <Snackbar variant="error">
          <p>
            This Action or it&apos;s origin has been flagged as an unsafe
            action, & has been blocked. If you believe this action has been
            blocked in error, please{' '}
            <a
              href="https://discord.gg/saydialect"
              className="cursor-pointer underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              submit an issue
            </a>
            .
            {!isPassingSecurityCheck &&
              ' Your action provider blocks execution of this action.'}
          </p>
          {isPassingSecurityCheck && (
            <button
              className="mt-3 font-semibold transition-colors hover:text-text-error-hover motion-reduce:transition-none"
              onClick={() => dispatch({ type: ExecutionType.UNBLOCK })}
            >
              Ignore warning & proceed
            </button>
          )}
        </Snackbar>
      );
    }

    if (overallState === 'unknown') {
      return (
        <Snackbar variant="warning">
          <p>
            This Action has not yet been registered. Only use it if you trust
            the source. This Action will not unfurl on X until it is registered.
            {!isPassingSecurityCheck &&
              ' Your action provider blocks execution of this action.'}
          </p>
          <a
            className="mt-3 inline-block font-semibold transition-colors hover:text-text-warning-hover motion-reduce:transition-none"
            href="https://discord.gg/saydialect"
            target="_blank"
            rel="noopener noreferrer"
          >
            Report
          </a>
        </Snackbar>
      );
    }

    return null;
  }, [executionState.status, isPassingSecurityCheck, overallState]);

  return (
    <Experimental__ActionLayout
      stylePreset={stylePreset}
      type={overallState}
      title={action.title}
      description={action.description}
      websiteUrl={websiteUrl}
      websiteText={websiteText}
      image={action.icon}
      action={action}
      error={
        executionState.status !== 'success'
          ? (executionState.errorMessage ?? action.error)
          : null
      }
      success={executionState.successMessage}
      buttons={buttons.map(asButtonProps)}
      inputs={inputs.map((input) => asInputProps(input))}
      form={form ? asFormProps(form) : undefined}
      disclaimer={disclaimer}
    />
  );
};
