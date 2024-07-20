import { Transaction, VersionedTransaction } from '@solana/web3.js';
import bs58 from 'bs58';
import { decodeBase64 } from 'ethers/utils';
console.log(decodeBase64, 'base64');
// Wallet connection handlers
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
const walletHandlers = {
  ethereum: {
    connect: async () => {
      if (typeof window.ethereum === 'undefined') {
        throw new Error('No Ethereum provider found');
      }
      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts',
      });
      return accounts[0];
    },
    sign: async (transaction, address) => {
      const transactionParameters = {
        to: transaction.to,
        from: address,
        value: transaction.value,
      };
      return window.ethereum.request({
        method: 'eth_sendTransaction',
        params: [transactionParameters],
      });
    },
  },
  solana: {
    connect: async () => {
      if (typeof window.solana === 'undefined') {
        throw new Error('No Solana provider found');
      }
      const response = await window.solana.connect();
      return response.publicKey.toString();
    },
    sign: async (transaction) => {
      console.log(transaction, 'signtxn');
      const txData = transaction?.transaction?.transaction;
      const decodedTx = Buffer.from(txData || '', 'base64');
      //   console.log(window.solana, 'decoded');
      const tx = convertBase58ToVersionedTransaction(txData);
      console.log(tx, 'transactionbase58');
      //   const tx = VersionedTransaction.deserialize(decodedTx);
      //   console.log(transaction, decodedTx, tx, window.solana, 'vrstxn');
      return window.solana.signTransaction(tx);
    },
  },
};
console.log('loaded page script');
// Message handling
const messageHandlers = {
  CONNECT_WALLET_ETHEREUM: async () => {
    const account = await walletHandlers.ethereum.connect();
    return { type: 'WALLET_CONNECTED_ETHEREUM', account };
  },
  CONNECT_WALLET_SOLANA: async () => {
    const account = await walletHandlers.solana.connect();
    return { type: 'WALLET_CONNECTED_SOLANA', account };
  },
  SIGN_TRANSACTION_ETHEREUM: async (data) => {
    if (!connectedAddress) {
      connectedAddress = await walletHandlers.ethereum.connect();
    }
    const transaction = JSON.parse(data.transaction);
    const txHash = await walletHandlers.ethereum.sign(
      transaction,
      connectedAddress,
    );
    return { type: 'TRANSACTION_SIGNED', txHash };
  },
  SIGN_TRANSACTION_SOLANA: async (data) => {
    if (!connectedAddress) {
      connectedAddress = await walletHandlers.solana.connect();
    }
    console.log(data, 'data');
    const response = await walletHandlers.solana.sign(data);
    console.log(response, 'resp123');
    return { type: 'TRANSACTION_SIGNED_SOLANA', signature: response };
  },
};

// Global state
let connectedAddress = '';

// Initialize
window.postMessage({ type: 'PAGE_SCRIPT_LOADED' }, '*');
window.postMessage({ type: 'ETHEREUM_READY' }, '*');

// Message listener
window.addEventListener('message', async (event) => {
  const { type, ...data } = event.data;
  console.log(type, data, type in messageHandlers, 'listerner');
  if (type in messageHandlers) {
    console.log(type, messageHandlers, 'typein');
    try {
      const response = await messageHandlers[type](data);
      console.log(response.response, 'responselistener');
      window.postMessage(response, '*');
    } catch (error) {
      console.error(`Error in ${type} handler:`, error);
      window.postMessage({ type: `${type}_ERROR`, error: error.message }, '*');
    }
  }
});
// AQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACAAQAHETmK4tBhIEtN9CUnv2N4JjiFxh+WumcTGGyZVtzl7RvkOAHIkXP+jIl40CFgl+ft6tNmzrEkeOe4BXS/9y4fqJA9t1pWG6qWtPmFmciR1xbrt4IW+b1nNcz2N5abYbCcsFU4MyHB1zUWWP4BY4xctw9+apRhOCxNIES1zTEXM3wlXZSneCsAyAweQdHJBQBLt3pgEalaBEYPaB++MBcb8Idd2kTDgevJ8HbnKZ5St0fb1obiOptAEVZ2vNTFtbFQBmdBBA/kB6qwUEagfnGzH2GY12XE3va/gn3W4Loqy/D+e3xnOF+P4h+lHPM3LG+ZVzAewdg2dCNMpYSeXB1OQPKLrAe9mrQtzAs/VBRIGdNVtV1wp3lk50kqu7ugfhC04qYOooB1OmwzhJMdP0VAtGEFeorq3jsZt+LUTfpecq1ZAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADBkZv5SEXMv/srbpyw5vnvIzlu8X3EmssQ5s6QAAAAAR51VvyMcBu7nTFbs5oFQf9sbLeo/SOUQKxzaJWvBOPBt324ddloZPZy+FGzut5rBy0he1fWzeROoz1hX7/AKlRPixdukLDvYMw2r2DTumX5VA1ifoAVfXgkOTnLswDEoyXJY9OJInxuz0QKRSODYMLWhOZ2v8QhASOe9jb6fhZtD/6J/XX9kp0wJsfKVh53ksJqzbfyd1RSzIap7OM5ejp+1EK83MmjT1zzQ1+7JrZiDJUdFimV+rpWv8WOPNoGAULAAUCwFwVAAsACQMEFwEAAAAAAA8GAAQAIgoNAQEMPQ0OAAMBBgQhIgwMEAweFB4SFgECICERHg4NDR8eExUMJCUcDggCGx0NHhoeGBcIBiMiGR4ODQ0fHgkFBwwtwSCbM0HWnIEDAwAAACZkAAEcAGQBAiZkAgNjhgEAAAAAAF33CAAAAAAAMgAADQMEAAABCQNEduVDWv4OSrBtL31MHVCfHvB3nCvyZHd6pvV3nwTgdAag9aH4n50EnPT299i3P1QAcs1JONaFz8fyatm+VYv0x+gbc9IO19sw2ylVBJgBA5cCBZlbqstBV6PXz3gn78I0+FNvZuZP0ol2eNtAK75XQ5aSjwOamJYCLTI=
