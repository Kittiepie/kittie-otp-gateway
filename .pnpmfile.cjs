/**
 * pnpm hook: edits a package's manifest before pnpm resolves dependencies.
 *
 * @prisma/client declares `prisma` (the CLI) and `typescript` as optional peer dependencies.
 * Because the api has the CLI as a devDependency, pnpm resolves the client *together with* it,
 * so `pnpm deploy --prod` would ship the CLI, Prisma Studio and TypeScript (~200 MB) in the
 * production image. The runtime client never uses them (only `prisma generate` does, at build
 * time), so the peers are dropped here. Both fields must go: pnpm treats an entry in
 * peerDependenciesMeta alone as an optional peer.
 */
const UNNEEDED_PEERS = ['prisma', 'typescript'];

module.exports = {
  hooks: {
    readPackage(pkg) {
      if (pkg.name === '@prisma/client') {
        for (const peer of UNNEEDED_PEERS) {
          delete pkg.peerDependencies?.[peer];
          delete pkg.peerDependenciesMeta?.[peer];
        }
      }
      return pkg;
    },
  },
};
