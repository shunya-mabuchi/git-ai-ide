export async function createBrowserGitRuntime(name: string) {
  const [{ default: git }, { default: LightningFS }] = await Promise.all([
    import("isomorphic-git"),
    import("@isomorphic-git/lightning-fs"),
  ]);
  const fs = new LightningFS(`git-ai-ide-${name}`);
  const dir = "/repo";

  return {
    dir,
    fs,
    git,
    async currentBranch() {
      return git.currentBranch({ fs, dir, fullname: false });
    },
    async init(defaultBranch = "main") {
      await git.init({ fs, dir, defaultBranch });
    },
    async statusMatrix() {
      return git.statusMatrix({ fs, dir });
    },
  };
}
