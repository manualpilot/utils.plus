declare module "node-forge" {
  namespace pki {
    function certificateExtensionsToAsn1(extensions: unknown[]): asn1.Asn1;
  }
}
