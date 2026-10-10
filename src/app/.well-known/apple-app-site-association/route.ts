/** Universal links: `https://www.anylink.space/links/{id}` opens the link in the iOS app when it's
 * installed. Apple's CDN fetches this from the exact domain, without following redirects. */
export function GET() {
  return Response.json({
    applinks: {
      details: [{ appIDs: ["376HNWM383.app.anylink.ios"], components: [{ "/": "/links/*" }] }],
    },
  });
}
