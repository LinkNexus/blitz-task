using Microsoft.AspNetCore.HttpOverrides;

namespace BlitzTask.Backend.Infrastructure.Extensions
{
    /// <summary>
    /// Configuration for <c>UseForwardedHeaders</c>, kept out of Program.cs so the tests can
    /// exercise the real thing rather than a copy of it — the failure this guards against is
    /// silent, so a test asserting against duplicated options would prove nothing.
    /// </summary>
    public static class ForwardedHeadersSetup
    {
        public static void Configure(ForwardedHeadersOptions options)
        {
            options.ForwardedHeaders =
                ForwardedHeaders.XForwardedProto
                | ForwardedHeaders.XForwardedHost
                | ForwardedHeaders.XForwardedFor;

            // ASP.NET only honours forwarded headers from a proxy it already trusts, and the
            // default trust list is loopback only. Traefik reaches this container over
            // dokploy-network, never over loopback, so with the defaults the headers are read
            // and then *silently discarded* — the request still looks like plain HTTP and the
            // email links still come out http://. Clearing both lists trusts whatever forwarded
            // the request.
            //
            // That is safe here only because the container publishes no port of its own and
            // Traefik is the single ingress, so nothing can reach Kestrel to spoof them. If the
            // app is ever exposed directly, this turns into a spoofing vector and has to be
            // narrowed to the proxy's actual address.
            options.KnownNetworks.Clear();
            options.KnownProxies.Clear();
        }
    }
}
