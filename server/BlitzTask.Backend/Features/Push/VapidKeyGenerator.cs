using System.Security.Cryptography;

namespace BlitzTask.Backend.Features.Push
{
    /// <summary>
    /// Prints a VAPID keypair for a self-hoster to paste into their environment.
    /// <para>
    /// Here rather than in the README as an <c>openssl</c> incantation, for the same reason
    /// <c>--seed</c> exists: the alternative is everyone assembling it by hand, differently, and
    /// a malformed key produces sends that look successful and never arrive.
    /// </para>
    /// <para>
    /// Written out rather than taken from the push library, which only consumes keys. VAPID is
    /// ECDSA over P-256: the private key is the raw 32-byte scalar, and the public key is the
    /// uncompressed point <c>0x04 ‖ X ‖ Y</c>. Both are <b>base64url</b> — the ordinary alphabet
    /// would be rejected by every push service, and the padding with it.
    /// </para>
    /// </summary>
    public static class VapidKeyGenerator
    {
        public const string Flag = "--vapid-keys";

        public static (string PublicKey, string PrivateKey) Generate()
        {
            using var key = ECDsa.Create(ECCurve.NamedCurves.nistP256);
            var parameters = key.ExportParameters(includePrivateParameters: true);

            var publicKey = new byte[65];
            publicKey[0] = 0x04;
            parameters.Q.X!.CopyTo(publicKey, 1);
            parameters.Q.Y!.CopyTo(publicKey, 33);

            return (Base64Url(publicKey), Base64Url(parameters.D!));
        }

        public static void Print()
        {
            var (publicKey, privateKey) = Generate();

            Console.WriteLine(
                $"""

                A VAPID keypair for this instance. Set all three in the environment:

                  Push__PublicKey={publicKey}
                  Push__PrivateKey={privateKey}
                  Push__Subject=mailto:you@example.com

                Keep them. Every push subscription a browser makes is bound to the public key it
                was created with, so replacing this pair silently invalidates all of them — the
                sends keep succeeding and nobody's device ever buzzes again.

                """
            );
        }

        private static string Base64Url(byte[] bytes) =>
            Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');
    }
}
