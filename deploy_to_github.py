from github_manager import GitHubManager
import os

if __name__ == "__main__":
    mgr = GitHubManager()
    repo = "diegoyus/tradinghyperliquid"
    # Usamos la ruta absoluta ya que estamos ejecutando desde la VM
    folder = "/sessions/clever-eager-hypatia/mnt/tradinghyperliquid"

    try:
        mgr.push_project(repo, folder)
        print(f"DONE: Successfully updated {repo}")
    except Exception as e:
        print(f"ERROR: {e}")
