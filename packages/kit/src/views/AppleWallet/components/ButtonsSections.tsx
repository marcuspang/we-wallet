/* eslint-disable @typescript-eslint/no-unsafe-return */
import type { FC } from 'react';
import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  Box,
  HStack,
  Pressable,
  Token,
  Typography,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import { isAllNetworks } from '@onekeyhq/engine/src/managers/network';
import { isValidCoingeckoId } from '@onekeyhq/engine/src/managers/token';
import type { Account } from '@onekeyhq/engine/src/types/account';
import type { Network } from '@onekeyhq/engine/src/types/network';
import type { Token as TokenType } from '@onekeyhq/engine/src/types/token';
import { isLightningNetworkByImpl } from '@onekeyhq/shared/src/engine/engineConsts';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import {
  useActiveWalletAccount,
  useNavigation,
  useNetwork,
  useTokenDetailInfo,
  useWallet,
} from '../../../hooks';
import { useAllNetworksSelectNetworkAccount } from '../../../hooks/useAllNetwoks';
import {
  FiatPayModalRoutes,
  MainRoutes,
  ModalRoutes,
  ReceiveTokenModalRoutes,
  RootRoutes,
  TabRoutes,
} from '../../../routes/routesEnum';
import BaseMenu from '../../Overlay/BaseMenu';
import { SendModalRoutes } from '../../Send/enums';
import { FavoritedButton } from '../../TokenDetail/TokenDetailHeader/Header';

import { ButtonItem } from './ButtonItem';

import type { IAccountToken } from '../../Overview/types';
import type { IButtonItem } from './ButtonItem';

type ISingleChainInfo = {
  network: Network;
  account: Account;
  token: TokenType;
};

export const ButtonsSection: FC<IAccountToken> = ({
  sendAddress,
  coingeckoId,
  symbol,
  logoURI,
}) => {
  const intl = useIntl();

  const isVerticalLayout = useIsVerticalLayout();
  const navigation = useNavigation();
  const { accountId, networkId, walletId } = useActiveWalletAccount();

  const {
    fiatUrls,
    tokens,
    loading: detailLoading,
  } = useTokenDetailInfo({
    accountId,
    coingeckoId,
    networkId,
  });

  const { wallet } = useWallet({
    walletId,
  });

  const loading = useMemo(
    () => isAllNetworks(networkId) && detailLoading,
    [detailLoading, networkId],
  );

  const { network: currentNetwork } = useNetwork({ networkId });

  const filter = useCallback(
    ({ network }: { network?: Network | null }) =>
      !!network?.id && !!tokens?.some((t) => t.networkId === network?.id),
    [tokens],
  );

  const selectNetworkAccount = useAllNetworksSelectNetworkAccount({
    networkId,
    accountId,
    filter,
  });

  const onSend = useCallback(
    ({ network, account, token }: ISingleChainInfo) => {
      navigation.navigate(RootRoutes.Modal, {
        screen: ModalRoutes.Send,
        params: {
          screen: SendModalRoutes.PreSendAddress,
          params: {
            accountId: account.id,
            networkId: network.id,
            from: '',
            to: '',
            amount: '',
            token: token?.address,
            tokenSendAddress: token?.sendAddress,
          },
        },
      });
    },
    [navigation],
  );

  const onReceive = useCallback(
    ({ network, account }: ISingleChainInfo) => {
      if (!wallet) {
        return;
      }
      if (isLightningNetworkByImpl(network.impl)) {
        navigation.navigate(RootRoutes.Modal, {
          screen: ModalRoutes.Receive,
          params: {
            screen: ReceiveTokenModalRoutes.CreateInvoice,
            params: {
              networkId: network.id,
              accountId: account.id,
            },
          },
        });
        return;
      }
      navigation.navigate(RootRoutes.Modal, {
        screen: ModalRoutes.Receive,
        params: {
          screen: ReceiveTokenModalRoutes.ReceiveToken,
          params: {
            address: account.address,
            displayAddress: account.displayAddress,
            wallet,
            network,
            account,
            template: account.template,
          },
        },
      });
    },
    [navigation, wallet],
  );

  const onSwap = useCallback(
    async ({ token, account: a, network: n }: ISingleChainInfo) => {
      if (!token) {
        return;
      }
      await backgroundApiProxy.serviceSwap.buyToken(token);
      if (a && n) {
        backgroundApiProxy.serviceSwap.setRecipientToAccount(a, n);
      }
      navigation.navigate(RootRoutes.Main, {
        screen: MainRoutes.Tab,
        params: {
          screen: TabRoutes.Swap,
        },
      });
    },
    [navigation],
  );

  const goToWebView = useCallback(
    (signedUrl: string) => {
      navigation.navigate(RootRoutes.Modal, {
        screen: ModalRoutes.FiatPay,
        params: {
          screen: FiatPayModalRoutes.MoonpayWebViewModal,
          params: {
            url: signedUrl,
          },
        },
      });
    },
    [navigation],
  );

  const onBuy = useCallback(
    async ({ token, account, network }: ISingleChainInfo) => {
      const signedUrl = await backgroundApiProxy.serviceFiatPay.getFiatPayUrl({
        type: 'buy',
        address: account?.address,
        tokenAddress: token?.address,
        networkId: network?.id,
      });
      goToWebView(signedUrl);
    },
    [goToWebView],
  );

  const onSell = useCallback(
    async ({ account, network, token }: ISingleChainInfo) => {
      const signedUrl = await backgroundApiProxy.serviceFiatPay.getFiatPayUrl({
        type: 'sell',
        address: account?.address,
        tokenAddress: token?.address,
        networkId: network?.id,
      });
      goToWebView(signedUrl);
    },
    [goToWebView],
  );

  const handlePress = useCallback(
    (item: IButtonItem) => {
      selectNetworkAccount().then(({ network, account }) => {
        const token = tokens?.find(
          (t) =>
            network?.id ===
            (t.networkId ?? `${t.impl ?? ''}--${t.chainId ?? ''}`),
        );
        if (token) {
          item.onPress?.({
            network,
            account,
            token: {
              ...token,
              sendAddress,
            },
          });
        }
      });
    },
    [selectNetworkAccount, tokens, sendAddress],
  );

  const showSwapOption = useMemo(
    () => !currentNetwork?.settings.hiddenAccountInfoSwapOption,
    [currentNetwork],
  );

  const showMoreOption = useMemo(
    () => !currentNetwork?.settings.hiddenAccountInfoMoreOption,
    [currentNetwork],
  );

  const { buttons, options } = useMemo(() => {
    const list: IButtonItem[] = [
      {
        id: 'action__send',
        onPress: onSend,
        icon: 'PaperAirplaneOutline',
      },
      {
        id: 'action__receive',
        onPress: onReceive,
        icon: 'QrCodeMini',
      },
      {
        id: 'title__swap',
        onPress: onSwap,
        icon: 'ArrowsRightLeftSolid',
        visible: () => showSwapOption,
      },
    ]
      .map((t) => ({ ...t, isDisabled: loading }))
      .filter((item) => !item.visible || item?.visible?.()) as IButtonItem[];
    const showSize = isVerticalLayout ? 4 : 3;
    return {
      buttons: list.slice(0, showSize),
      options: list.slice(showSize).map((item) => ({
        ...item,
        onPress: () => {
          handlePress(item);
        },
      })),
    };
  }, [
    networkId,
    fiatUrls,
    loading,
    handlePress,
    isVerticalLayout,
    onBuy,
    onSell,
    onSwap,
    onReceive,
    onSend,
    showSwapOption,
    showMoreOption,
  ]);

  return (
    <Box width="100%" paddingTop={8}>
      <HStack justifyContent="space-between" width="100%">
        {!isVerticalLayout && (
          <HStack alignItems="center">
            <Token
              showInfo={false}
              size={8}
              token={{
                logoURI,
              }}
            />
            <Typography.Heading ml="2">{symbol}</Typography.Heading>
          </HStack>
        )}
        <HStack justifyContent="space-between" width="100%">
          {buttons.map((item) => (
            <ButtonItem
              key={item.id}
              onPress={() => {
                handlePress(item);
              }}
              icon={item.icon}
              text={intl.formatMessage({
                id: item.id,
              })}
              isDisabled={loading}
            />
          ))}
          {isValidCoingeckoId(coingeckoId) && !isVerticalLayout ? (
            <FavoritedButton coingeckoId={coingeckoId} />
          ) : null}
          {showMoreOption && options?.length ? (
            <BaseMenu ml="26px" options={options}>
              <Pressable flex={isVerticalLayout ? 1 : undefined}>
                <ButtonItem
                  icon="EllipsisVerticalOutline"
                  text={intl.formatMessage({
                    id: 'action__more',
                  })}
                  isDisabled={loading}
                />
              </Pressable>
            </BaseMenu>
          ) : null}
        </HStack>
      </HStack>
    </Box>
  );
};
