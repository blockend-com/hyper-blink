// @ts-nocheck
import clsx from 'clsx';
import { useEffect, useState, type ChangeEvent, type ReactNode } from 'react';
import type { ExtendedActionState } from '../api';
import { Badge } from './Badge';
import { Button } from './Button';
import {
  CheckIcon,
  ExclamationShieldIcon,
  InfoShieldIcon,
  LinkIcon,
  SpinnerDots,
} from './icons';

type ActionType = ExtendedActionState;

export type StylePreset = 'default' | 'x-dark' | 'x-light' | 'custom';
const stylePresetClassMap: Record<StylePreset, string> = {
  default: 'dial-light',
  'x-dark': 'x-dark',
  'x-light': 'x-light',
  custom: 'custom',
};

interface LayoutProps {
  stylePreset?: StylePreset;
  image?: string;
  error?: string | null;
  success?: string | null;
  websiteUrl?: string | null;
  websiteText?: string | null;
  disclaimer?: ReactNode;
  type: ActionType;
  title: string;
  description: string;
  buttons?: ButtonProps[];
  inputs?: InputProps[];
  form?: FormProps;
  tempObj?: {};
}
export interface ButtonProps {
  text: string | null;
  loading?: boolean;
  variant?: 'default' | 'success' | 'error';
  disabled?: boolean;
  onClick: (params?: Record<string, string>) => void;
}

export interface InputProps {
  placeholder?: string;
  name: string;
  disabled: boolean;
  required?: boolean;
  button?: ButtonProps;
}

export interface FormProps {
  inputs: Array<Omit<InputProps, 'button'>>;
  button: ButtonProps;
}

const Linkable = ({
  url,
  className,
  children,
}: {
  url?: string | null;
  className?: string;
  children: ReactNode | ReactNode[];
}) =>
  url ? (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
    >
      {children}
    </a>
  ) : (
    <div className={className}>{children}</div>
  );
function getDescription(description: string) {
  let splitDesc = description.slice(23);
  console.log(splitDesc, 'splitdesc');
  // var doc = new DOMParser().parseFromString(splitDesc, 'text/xml');
  // console.log('description', doc, description);
  return (
    <>
      <p style={{ marginTop: '8px' }}>Here is your portfolio:</p>
      <div dangerouslySetInnerHTML={{ __html: splitDesc }}></div>
    </>
  );
}
export const ActionLayout = ({
  stylePreset = 'default',
  title,
  description,
  image,
  websiteUrl,
  websiteText,
  type,
  disclaimer,
  buttons,
  inputs,
  form,
  error,
  success,
  action,
}: LayoutProps) => {
  const [tokenData, setTokenData] = useState([]);
  const [coin, setCoin] = useState({ symbol: 'USDT' });
  const [opCoin, setOpCoin] = useState({ symbol: 'SOL' });
  const [tokenObj, setTokenObj] = useState({}); //tokenObj
  console.log(action, 'actionlayout');
  async function fetchTokens() {
    try {
      const req = await fetch(
        'https://api2.blockend.com/v1/tokens?chainId=sol',
      );
      const res = await req.json();
      console.log(res, 'Response');
      if (res !== null && typeof res === 'object') {
        setTokenData(res.data);
      }
    } catch (e) {
      console.error('Failed to fetch tokens', e);
    }
  }
  console.log(tokenData, 'tokendata');
  useEffect(() => {
    fetchTokens();
  }, []);
  function handleCoin(event: ChangeEvent<HTMLSelectElement>, name: string) {
    console.log(name, 'nameonchange');
    if (name == 'output') {
      setOpCoin((prev) => ({ ...prev, symbol: event.target.value }));
    } else {
      setCoin((prev) => ({ ...prev, symbol: event.target.value }));
    }
  }

  useEffect(() => {
    let tempObj: Record<string, (typeof tokenData)[]> = {};
    tokenData?.slice(0, 6).forEach((token: { symbol: string }) => {
      const tokenEntry = { [token.symbol]: token };
      Object.assign(tempObj, tokenEntry);
    });
    setTokenObj(tempObj);
  }, [tokenData]);
  console.log(coin, opCoin, tokenObj, 'selectedcoin');
  return (
    <div className={clsx('blink', stylePresetClassMap[stylePreset])}>
      <div
        style={{ border: '1px solid #202327' }}
        className="mt-3 w-full cursor-default overflow-hidden rounded-2xl border border-stroke-primary bg-bg-primary shadow-action"
      >
        {image && (
          <Linkable url={websiteUrl} className="block px-5 pt-5">
            <img
              className={clsx('w-full rounded-xl object-cover object-left', {
                'aspect-square': !form,
                'aspect-[2/1]': form,
              })}
              src={image}
              alt="action-image"
            />
          </Linkable>
        )}
        <div className="flex flex-col p-5">
          <div className="mb-2 flex items-center gap-2">
            {websiteUrl && (
              <a
                href={websiteUrl}
                target="_blank"
                className="group -mt-1 inline-flex items-center truncate text-subtext hover:cursor-pointer"
                rel="noopener noreferrer"
              >
                <LinkIcon className="mr-2 text-icon-primary transition-colors group-hover:text-icon-primary-hover motion-reduce:transition-none" />
                <span className="text-text-link transition-colors group-hover:text-text-link-hover group-hover:underline motion-reduce:transition-none">
                  {websiteText ?? websiteUrl}
                </span>
              </a>
            )}
            {websiteText && !websiteUrl && (
              <span className="-mt-1 inline-flex items-center truncate text-subtext text-text-link">
                {websiteText}
              </span>
            )}
            <a
              href="https://docs.dialect.to/documentation/actions/security"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center"
            >
              {type === 'malicious' && (
                <Badge
                  variant="error"
                  icon={<ExclamationShieldIcon width={13} height={13} />}
                >
                  Blocked
                </Badge>
              )}
              {type === 'trusted' && (
                <Badge
                  variant="default"
                  icon={<InfoShieldIcon width={13} height={13} />}
                />
              )}
              {type === 'unknown' && (
                <Badge
                  variant="warning"
                  icon={<InfoShieldIcon width={13} height={13} />}
                />
              )}
            </a>
          </div>
          <span
            style={{ marginBottom: '2px' }}
            className="mb-0.5 text-text font-semibold text-text-primary"
          >
            {title}
          </span>
          <span
            style={{ marginBottom: '16px' }}
            className="mb-4 whitespace-pre-wrap text-subtext text-text-secondary"
          >
            {action._url.includes('/actions/portfolio')
              ? getDescription(description)
              : description}
          </span>
          {disclaimer && <div className="mb-4">{disclaimer}</div>}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '5px',
              width: '100%',
            }}
          >
            {action._data?.selectors ? (
              action._data?.selectors.map((item, i) => (
                <div key={i} style={{ width: '50%' }}>
                  <p>{item.name}</p>
                  <select
                    style={{
                      paddingTop: '10px',
                      paddingRight: '4px',
                      paddingLeft: '4px',
                      paddingBottom: '10px',
                      width: '100%',
                      borderRadius: '8px',
                    }}
                    name={item.name}
                    id={item.name}
                    onClick={(e) => {
                      e.stopPropagation();
                    }}
                    value={
                      item.name == 'output' ? opCoin?.symbol : coin?.symbol
                    }
                    onChange={(e) => {
                      handleCoin(e, item.name);
                    }}
                  >
                    {item.options.map(
                      (item: { label: string; value: string }, i) => (
                        <option
                          onClick={(e) => console.log(e, 'option console')}
                          onChange={(e) => console.log(e, 'option console')}
                          value={item.value}
                        >
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '4px',
                            }}
                          >
                            {item?.image ? (
                              <img
                                src={item.image}
                                width={20}
                                height={20}
                                alt="img"
                              />
                            ) : (
                              <></>
                            )}
                            {item.label}
                          </div>
                        </option>
                      ),
                    )}
                  </select>
                </div>
              ))
            ) : (
              <></>
            )}
          </div>
          <ActionContent
            form={form}
            inputs={inputs}
            buttons={buttons}
            tempObj={tokenObj}
            coin={coin}
            opCoin={opCoin}
          />
          {success && (
            <span className="mt-4 flex justify-center text-subtext text-text-success">
              {success}
            </span>
          )}
          {error && !success && (
            <span className="mt-4 flex justify-center text-subtext text-text-error">
              {error}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

const ActionContent = ({
  form,
  inputs,
  buttons,
  tempObj,
  coin,
  opCoin,
}: Pick<LayoutProps, 'form' | 'inputs' | 'buttons'>) => {
  if (form) {
    return (
      <ActionForm form={form} tempObj={tempObj} coin={coin} opCoin={opCoin} />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {buttons && buttons.length > 0 && (
        <div
          style={{ marginTop: '10px', marginBottom: '4px' }}
          className="my-2 flex flex-wrap items-center gap-2"
        >
          {buttons?.map((it, index) => {
            console.log(it, 'it123');
            return (
              <div
                key={index}
                style={{ flex: 1 }}
                className="flex flex-grow basis-[calc(33.333%-2*4px)]"
              >
                <ActionButton
                  {...it}
                  onClick={() =>
                    it.onClick({
                      amount:
                        it.text == '$1'
                          ? 1
                          : it.text == '$10'
                            ? 10
                            : it.text == '$100'
                              ? 100
                              : it.text == '$1000'
                                ? 1000
                                : it.text == '$10000'
                                  ? 10000
                                  : 1,
                      sourceMint: tempObj[coin.symbol]?.address,
                      coinSymbol: coin.symbol,
                      opCoinSymbol: opCoin?.symbol,
                    })
                  }
                  tempObj={tempObj}
                  coin={coin}
                  opCoin={opCoin}
                />
              </div>
            );
          })}
        </div>
      )}
      {inputs?.map((input) => (
        <ActionInput
          key={input.name}
          {...input}
          tempObj={tempObj}
          coin={coin}
          opCoin={opCoin}
        />
      ))}
    </div>
  );
};

const ActionForm = ({
  form,
  tempObj,
  coin,
  opCoin,
}: Required<Pick<LayoutProps, 'form'>>) => {
  const [values, setValues] = useState(
    Object.fromEntries(form.inputs.map((i) => [i.name, ''])),
  );

  const onChange = (name: string, value: string) => {
    setValues((prev) => ({ ...prev, [name]: value }));
  };

  const disabled = form.inputs.some((i) => i.required && values[i.name] === '');

  return (
    <div className="flex flex-col gap-3">
      {form.inputs.map((input) => (
        <ActionInput
          key={input.name}
          {...input}
          onChange={(v) => onChange(input.name, v)}
          tempObj={tempObj}
          coin={coin}
          opCoin={opCoin}
        />
      ))}
      <ActionButton
        {...form.button}
        onClick={() =>
          form.button.onClick({
            ...values,
            sourceMint: tempObj[coin.symbol]?.address,
            destMint: tempObj[opCoin.symbol]?.address,
            coinSymbol: coin.symbol,
            opCoinSymbol: opCoin?.symbol,
          })
        }
        disabled={form.button.disabled || disabled}
      />
    </div>
  );
};

const ActionInput = ({
  placeholder,
  name,
  button,
  disabled,
  onChange: extOnChange,
  required,
  coin,
  tempObj,
  opCoin,
}: InputProps & { onChange?: (value: string) => void }) => {
  const [value, onChange] = useState('');

  const extendedChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange(e.currentTarget.value);
    extOnChange?.(e.currentTarget.value);
  };
  console.log(coin, tempObj, 'coin, tempObj');
  const placeholderWithRequired =
    (placeholder || 'Type here...') + (required ? '*' : '');

  return (
    <div
      style={{ border: '1px solid transparent' }}
      className={clsx(
        'flex items-center gap-2 rounded-input border border-input-stroke transition-colors focus-within:border-input-stroke-selected motion-reduce:transition-none',
        {
          'hover:border-input-stroke-hover hover:focus-within:border-input-stroke-selected':
            !disabled,
        },
      )}
    >
      <input
        placeholder={placeholderWithRequired}
        value={value}
        disabled={disabled}
        onChange={extendedChange}
        style={{ height: '45px', borderRadius: '16px', paddingLeft: '10px' }}
        className="my-3  flex-1 truncate bg-input-bg text-text-input outline-none placeholder:text-text-input-placeholder disabled:text-text-input-disabled"
      />
      {button && (
        <div className="my-2 mr-2">
          <ActionButton
            {...button}
            onClick={() =>
              button.onClick({
                [name]: value,
                sourceMint: tempObj[coin.symbol]?.address,
                destMint: tempObj[coin.symbol]?.address,
                coinSymbol: coin.symbol,
                opCoinSymbol: opCoin?.symbol,
              })
            }
            disabled={button.disabled || value === ''}
          />
        </div>
      )}
    </div>
  );
};

const ActionButton = ({
  text,
  loading,
  disabled,
  variant,
  onClick,
}: ButtonProps) => {
  const ButtonContent = () => {
    if (loading)
      return (
        <span className="flex flex-row items-center justify-center gap-2 text-nowrap">
          {text} <SpinnerDots />
        </span>
      );
    if (variant === 'success')
      return (
        <span className="flex flex-row items-center justify-center gap-2 text-nowrap">
          {text}
          <CheckIcon />
        </span>
      );
    return text;
  };

  return (
    <Button onClick={() => onClick()} disabled={disabled} variant={variant}>
      <ButtonContent />
    </Button>
  );
};
