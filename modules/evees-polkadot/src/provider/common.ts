import CID from 'cids';

export const ZERO_HEX_32 = '0x' + new Array(32).fill(0).join('');

const constants: [string, number][] = [
  ['base8', 37],
  ['base10', 39],
  ['base16', 66],
  ['base32', 62],
  ['base32pad', 63],
  ['base32hex', 76],
  ['base32hexpad', 74],
  ['base32z', 68],
  ['base58flickr', 90],
  ['base58btc', 122],
  ['base64', 109],
  ['base64pad', 77],
  ['base64url', 75],
  ['Ubase64urlpad', 55]
];

const multibaseToUint = (multibaseName: string): number => {
  return constants.filter(e => e[0] == multibaseName)[0][1];
};

const uintToMultibase = (number: number): string => {
  return constants.filter(e => e[1] == number)[0][0];
};

export const bytes32ToCid = bytes => {
  const cidHex1 = bytes[0].substring(2);
  const cidHex0 = bytes[1].substring(2); /** LSB */

  const cidHex = cidHex1.concat(cidHex0).replace(/^0+/, '');
  if (cidHex === '') return '';

  const cidBufferWithBase = Buffer.from(cidHex, 'hex');

  const multibaseCode = cidBufferWithBase[0];
  const cidBuffer = cidBufferWithBase.slice(1);

  const multibaseName = uintToMultibase(multibaseCode);

  /** Force Buffer class */
  const cid = new CID(cidBuffer);

  return cid.toBaseEncodedString(multibaseName);
};