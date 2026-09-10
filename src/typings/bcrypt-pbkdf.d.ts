declare module "bcrypt-pbkdf" {
  const bcrypt: {
    pbkdf(
      password: Uint8Array,
      passwordLength: number,
      salt: Uint8Array,
      saltLength: number,
      key: Uint8Array,
      keyLength: number,
      rounds: number,
    ): number;
  };
  export default bcrypt;
}
