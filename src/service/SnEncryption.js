import _sodium from 'libsodium-wrappers-sumo';
import { pki, pkcs5, md } from 'node-forge';
import randomBytes from "randombytes";
import nacl from 'tweetnacl';
import naclutil from 'tweetnacl-util';

let sodium: any = null;

(async () => {
  await _sodium.ready;
  sodium = _sodium;
})();

function toHexString(byteArray: Uint8Array): string {
  let s = "";
  // tslint:disable-next-line:only-arrow-functions
  byteArray.forEach(function (byte) {
    // tslint:disable-next-line:no-bitwise
    s += ("0" + (byte & 0xff).toString(16)).slice(-2);
  });
  return s;
}

function hexStringToArrayBuffer(hexString: string): Uint8Array {
  // remove the leading 0x
  hexString = hexString.replace(/^0x/, '');
  
  // ensure even number of characters
  if (hexString.length % 2 != 0) {
      console.log('WARNING: expecting an even number of characters in the hexString');
  }
  
  // check for some non-hex characters
  var bad = hexString.match(/[G-Z\s]/i);
  if (bad) {
      console.log('WARNING: found non-hex characters', bad);    
  }
  
  // split the string into pairs of octets
  var pairs = hexString.match(/[\dA-F]{2}/gi);
  
  // convert the octets to integers
  var integers = pairs?.map(function(s) {
      return parseInt(s, 16);
  });
  
  var array = new Uint8Array(integers? integers:[]);
  console.log(array);
  
  return array;
}


function genKeyPairFromSeed(seed: string): { publicKey: Uint8Array; privateKey: Uint8Array } {
  // Get a 32-byte seed.
  seed = pkcs5.pbkdf2(seed, "", 1000, 32, md.sha256.create());
  const { publicKey, privateKey } = pki.ed25519.generateKeyPair({ seed });
  // return { publicKey: toHexString(publicKey), privateKey: toHexString(privateKey) };
  return { publicKey, privateKey };
}
function makeSeed(length: number): string {
  // Cryptographically-secure random number generator. It should use the
  // built-in crypto.getRandomValues in the browser.
  const array = randomBytes(length);
  return toHexString(array);
}
function genKeyPairAndSeed(length = 64): { publicKey: Uint8Array; privateKey: Uint8Array; seed: string } {
  const seed = makeSeed(length);
  return { ...genKeyPairFromSeed(seed), seed };
}

// ########### BOB #############
// "6cffb176971ad1978618c8ed2f84bd2f59a73be9c916614974ef62ef82e23fe5"
// ED25519 : publicKey : 9da11916898665c2b21099e827d6f19d9d466db43a57d47d48b02882cdbb1076
// ED25519 : publicKey : base64 : naEZFomGZcKyEJnoJ9bxnZ1GbbQ6V9R9SLAogs27EHY=
// ED25519 : privateKey : 244a06a7dd2b145b6511fa0fed9126af5a7d9ab39c30a22857612a1d6d06f8409da11916898665c2b21099e827d6f19d9d466db43a57d47d48b02882cdbb1076
// ED25519 : privateKey : base64 : JEoGp90rFFtlEfoP7ZEmr1p9mrOcMKIoV2EqHW0G+EA=
// X25519 : publicKey : 224530721ac618f0d98f57affb5efab5bdfd82120876875298d6f9049c901e2967ty
// X25519 : publicKey : base64 : IkUwchrGGPDZj1ev+176tb39ghIIdodSmNb5BJyQHik=
// X25519 : privateKey : 98aaa8f218c4250d6bccd0b6dbc9a6a499bf39d738340c272d9f29c7a412126e
// X25519 : privateKey : base64 : mKqo8hjEJQ1rzNC228mmpJm/Odc4NAwnLZ8px6QSEm4=
// ########### ALICE #############
// ED25519 : publicKey : ce8fe6d1e9d258ae55abc5216a9e301341329d26b728acc500df07e6b5456902
// ED25519 : publicKey : base64 : zo/m0enSWK5Vq8Uhap4wE0EynSa3KKzFAN8H5rVFaQI=
// ED25519 : privateKey : 03ba0678b600f33435d75bfd7bbd49dbc7ff5dc031a52cd2428e9fe158ec3a81ce8fe6d1e9d258ae55abc5216a9e301341329d26b728acc500df07e6b5456902
// ED25519 : privateKey : base64 : A7oGeLYA8zQ111v9e71J28f/XcAxpSzSQo6f4VjsOoE=
// X25519 : publicKey : 21776783cceda1333eed237387f23e6f1f32d1e8283007286e0f393801007e02
// X25519 : publicKey : base64 : IXdng8ztoTM+7SNzh/I+bx8y0egoMAcobg85OAEAfgI=
// X25519 : privateKey : 781a5c29e486ba9f383a9a4239be53fe0974452a20ecc6f3b07b335c1f55bc6f
// X25519 : privateKey : base64 : eBpcKeSGup84OppCOb5T/gl0RSog7MbzsHszXB9VvG8=

// ### Data Encryption for loggedIn user
export async function encryptData(hexPrivateKey: string, hexPublicKey: string, data: string, strNonce: string): Promise<any> {
  try {
    //await _sodium.ready;
    // const sodium = _sodium;
    let publicKey: Uint8Array = hexStringToArrayBuffer(hexPublicKey);
    let privateKey: Uint8Array = hexStringToArrayBuffer(hexPrivateKey);
    let nonce: Uint8Array = nacl.randomBytes(nacl.box.nonceLength);

    const xPublicKey = sodium.crypto_sign_ed25519_pk_to_curve25519(publicKey); // Public key is of current logged in user(ephemeralPublicKey) OR Public key of another user.

    //console.log("xPublicKey: " + naclutil.decodeBase64(publicKey));
    const xPrivateKey = sodium.crypto_sign_ed25519_sk_to_curve25519(privateKey); // LoggedIn users Private Key
    //console.log("xPublicKey: " + naclutil.decodeBase64(privateKey));
    // Bob encrypts message for Alice or Bobs encrypts his own file using ephemeral/drived publicKeys
    const box = nacl.box(
      naclutil.decodeUTF8(data),
      nonce,
      xPublicKey,
      xPrivateKey
    )
    // we may add public key here
    const cipherObject = { version: "v1", ciphertext: naclutil.encodeBase64(box), nonce: naclutil.encodeBase64(nonce) };
    // tslint:disable-next-line:no-console
    console.log("box: " + cipherObject.ciphertext);
    // tslint:disable-next-line:no-console
    console.log("nonce: " + cipherObject.nonce);
    //return Buffer.from(message).toString('base64');

    console.log("cipherObject" + JSON.stringify(cipherObject));
    return cipherObject;
  }
  catch (e) {
    throw e;
  }
};
//encryptData ("P4UPEMoG1qWOfe3soMQRoQPyRZvIuL/95ByWpYBUQIa8m3WMFN3PdUgFb3PIguSV1dJPD9tamqCLX76Ag9t2Gw==","gvvJpIAE27HKX40s520U8atHAx1cErQp2B/uRe2wmBo=","Hello SkySpaces !!","ldB22oYZh/HP46XVJCRh/J6qOsbV/v7s");


export const decryptData = async (hexPrivateKey: string, hexPublicKey: string, data: any): Promise<any> => {
  try {
    // await _sodium.ready;
    // const sodium = _sodium;

    let publicKey: Uint8Array = hexStringToArrayBuffer(hexPublicKey);
    let privateKey: Uint8Array = hexStringToArrayBuffer(hexPrivateKey);

    const cipherObj = data;
    const box = naclutil.decodeBase64(cipherObj.ciphertext);
    const nonce = naclutil.decodeBase64(cipherObj.nonce);
    const xPrivateKey = sodium.crypto_sign_ed25519_sk_to_curve25519(privateKey); // LoggedIn users Private Key
    const xPublicKey = sodium.crypto_sign_ed25519_pk_to_curve25519(publicKey); // Public key is of current logged in user(ephemeralPublicKey) OR Public key of another user.
    // Alice decrypts message from Bob(using her PubKey) or Alice decrypts his own file using ephemeral/drived privatekey
    const payload = nacl.box.open(box, nonce, xPublicKey, xPrivateKey);

    const plainTextMessage = payload ? naclutil.encodeUTF8(payload) : "";
    // tslint:disable-next-line:no-console
    console.log("Decrypted: " + plainTextMessage);
    return JSON.parse(plainTextMessage);
  }
  catch (e) {
    throw e;
  }
};
//decryptData ("e8v2WhHuXaz2JhLhlt4ny+I0xEgKxdCzXsjQ2oZRgleC+8mkgATbscpfjSznbRTxq0cDHVwStCnYH+5F7bCYGg==","vJt1jBTdz3VIBW9zyILkldXSTw/bWpqgi1++gIPbdhs=","{\"version\":\"v1\",\"ciphertext\":\"YYFFrfY0xd6PqPNzrx5soLOtXsmkPviEzoh0ine4h6+oMQ==\",\"nonce\":\"ldB22oYZh/HP46XVJCRh/J6qOsbV/v7s\"}");
const convertEdToCurve = async (): Promise<void> => {
  try {
    await _sodium.ready;
    const sodium = _sodium;
    // BOB
    // tslint:disable-next-line:no-console
    console.log("########### BOB #############");
    const bob = genKeyPairAndSeed(32);
    // tslint:disable-next-line:no-console
    console.log("ED25519 : publicKey : " + toHexString(bob.publicKey));
    // tslint:disable-next-line:no-console
    console.log("ED25519 : publicKey : base64 : " + Buffer.from(bob.publicKey).toString('base64'));
    // tslint:disable-next-line:no-console
    console.log("ED25519 : privateKey : " + toHexString(bob.privateKey));
    // tslint:disable-next-line:no-console
    console.log("ED25519 : privateKey : base64 : " + Buffer.from(bob.privateKey.slice(0, 32)).toString('base64'));
    // function buf2hex(buffer) { // buffer is an ArrayBuffer
    //   return Array.prototype.map.call(new Uint8Array(buffer), x => ('00' + x.toString(16)).slice(-2)).join('');
    // }
    // tslint:disable-next-line:variable-name
    const bob_curve_pk = sodium.crypto_sign_ed25519_pk_to_curve25519(bob.publicKey);
    // tslint:disable-next-line:no-console
    console.log("X25519 : publicKey : " + toHexString(bob_curve_pk));
    // tslint:disable-next-line:no-console
    console.log("X25519 : publicKey : base64 : " + Buffer.from(bob_curve_pk).toString('base64'));
    // tslint:disable-next-line:variable-name
    const bob_curve_sk = sodium.crypto_sign_ed25519_sk_to_curve25519(bob.privateKey);
    // tslint:disable-next-line:no-console
    console.log("X25519 : privateKey : " + toHexString(bob_curve_sk));
    // tslint:disable-next-line:no-console
    console.log("X25519 : privateKey : base64 : " + Buffer.from(bob_curve_sk).toString('base64'));
    // ALICE
    // tslint:disable-next-line:no-console
    console.log("########### ALICE #############");
    const alice = genKeyPairAndSeed(32);
    // tslint:disable-next-line:no-console
    console.log("ED25519 : publicKey : " + toHexString(alice.publicKey));
    // tslint:disable-next-line:no-console
    console.log("ED25519 : publicKey : base64 : " + Buffer.from(alice.publicKey).toString('base64'));
    // tslint:disable-next-line:no-console
    console.log("ED25519 : privateKey : " + toHexString(alice.privateKey));
    // tslint:disable-next-line:no-console
    console.log("ED25519 : privateKey : base64 : " + Buffer.from(alice.privateKey.slice(0, 32)).toString('base64'));
    // function buf2hex(buffer) { // buffer is an ArrayBuffer
    //   return Array.prototype.map.call(new Uint8Array(buffer), x => ('00' + x.toString(16)).slice(-2)).join('');
    // }
    // tslint:disable-next-line:variable-name
    const alice_curve_pk = sodium.crypto_sign_ed25519_pk_to_curve25519(alice.publicKey);
    // tslint:disable-next-line:no-console
    console.log("X25519 : publicKey : " + toHexString(alice_curve_pk));
    // tslint:disable-next-line:no-console
    console.log("X25519 : publicKey : base64 : " + Buffer.from(alice_curve_pk).toString('base64'));
    // tslint:disable-next-line:variable-name
    const alice_curve_sk = sodium.crypto_sign_ed25519_sk_to_curve25519(alice.privateKey);
    // tslint:disable-next-line:no-console
    console.log("X25519 : privateKey : " + toHexString(alice_curve_sk));
    // tslint:disable-next-line:no-console
    console.log("X25519 : privateKey : base64 : " + Buffer.from(alice_curve_sk).toString('base64'));


    // tslint:disable-next-line:no-console
    console.log("########### STARTING ENCRYPTION #############");
    // generating key pairs
    // const bob = nacl.box.keyPair()
    // const alice = nacl.box.keyPair()
    // generating one time nonce for encryption
    const nonce = nacl.randomBytes(24)
    // message for Alice
    const utf8 = 'Hello Alice'
    // Bob encrypts message for Alice
    const box = nacl.box(
      naclutil.decodeUTF8(utf8),
      nonce,
      alice_curve_pk,
      bob_curve_sk
    )
    // somehow send this message to Alice
    const message = { box, nonce }
    // tslint:disable-next-line:no-console
    console.log("box: " + Buffer.from(message.box).toString('base64'));
    // tslint:disable-next-line:no-console
    console.log("nonce: " + Buffer.from(nonce).toString('base64'));

  }
  catch (e) {
    throw e;
  }
};
//convertEdToCurve();