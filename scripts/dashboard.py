"""DevFridge World Creator — local Tkinter settings dashboard."""

from __future__ import annotations

import os
import signal
import subprocess
import sys
import threading
import webbrowser
from pathlib import Path
from tkinter import BooleanVar, StringVar, Tk, messagebox, ttk
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
from tkinter.scrolledtext import ScrolledText

ROOT = Path(__file__).resolve().parents[1]
ENV_PATH = ROOT / ".env"
EXAMPLE_PATH = ROOT / ".env.example"
PORTAL = "https://discord.com/developers/applications"
CHANNEL = "https://discord.com/channels/1190606959246835764/1549687923350175784"

FIELDS = [
    ("Discord", "DISCORD_APPLICATION_ID", "Application ID", False),
    ("Discord", "DISCORD_PUBLIC_KEY", "Public Key", False),
    ("Discord", "DISCORD_BOT_TOKEN", "Bot Token", True),
    ("Server", "DISCORD_REVIEW_GUILD_ID", "Guild ID", False),
    ("Server", "DISCORD_CREATOR_CHANNEL_ID", "Canale creator", False),
    ("Server", "DISCORD_REVIEW_CHANNEL_ID", "Canale review", False),
    ("Server", "DISCORD_ADMIN_USER_IDS", "Admin user IDs (comma)", False),
    ("App", "CREATOR_BASE_URL", "Creator base URL", False),
    ("AI 3D (Three.js GLB)", "THREED_PROVIDER", "Provider", False),
    ("AI 3D (Three.js GLB)", "MESHY_API_KEY", "Meshy API key", True),
    ("AI 3D (Three.js GLB)", "MESHY_AI_MODEL", "Meshy model", False),
    ("AI 3D (Three.js GLB)", "STYLE_PRESET", "Character style", False),
]

COMBOS = {
    "THREED_PROVIDER": ("meshy", "placeholder"),
    "MESHY_AI_MODEL": ("latest", "meshy-5", "meshy-6", "meshy-7"),
    "STYLE_PRESET": ("pastacast",),
}


def parse_env(text: str) -> dict[str, str]:
    out: dict[str, str] = {}
    for line in text.splitlines():
        trimmed = line.strip()
        if not trimmed or trimmed.startswith("#") or "=" not in trimmed:
            continue
        key, raw = trimmed.split("=", 1)
        value = raw.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
            value = value[1:-1]
        out[key.strip()] = value
    return out


def dump_env(values: dict[str, str]) -> str:
    order: list[str] = []
    seen: set[str] = set()
    if EXAMPLE_PATH.exists():
        for line in EXAMPLE_PATH.read_text(encoding="utf-8").splitlines():
            trimmed = line.strip()
            if trimmed and not trimmed.startswith("#") and "=" in trimmed:
                key = trimmed.split("=", 1)[0].strip()
                if key not in seen:
                    order.append(key)
                    seen.add(key)
    for key in values:
        if key not in seen:
            order.append(key)
    lines = [
        "# DevFridge World Creator — saved by scripts/dashboard.py",
        "",
    ]
    for key in order:
        val = values.get(key, "")
        if any(ch in val for ch in ' \n#"\''):
            val = '"' + val.replace("\\", "\\\\").replace('"', '\\"') + '"'
        lines.append(f"{key}={val}")
    return "\n".join(lines) + "\n"


def tsx() -> list[str]:
    local = ROOT / "node_modules" / ".bin" / "tsx.cmd"
    if local.exists():
        return [str(local)]
    return ["npx.cmd", "--yes", "tsx"]


def load_values() -> dict[str, str]:
    if not ENV_PATH.exists() and EXAMPLE_PATH.exists():
        ENV_PATH.write_text(EXAMPLE_PATH.read_text(encoding="utf-8"), encoding="utf-8")
    text = ENV_PATH.read_text(encoding="utf-8") if ENV_PATH.exists() else ""
    return parse_env(text)


class Dashboard:
    def __init__(self, root: Tk) -> None:
        self.root = root
        self.root.title("DevFridge World Creator")
        self.root.geometry("900x860")
        self.root.minsize(760, 700)
        self.vars: dict[str, StringVar] = {}
        self.entries: dict[str, ttk.Entry] = {}
        self.show_secrets = BooleanVar(value=False)
        self.proc: subprocess.Popen[str] | None = None
        self._build()
        self.reload()

    def _build(self) -> None:
        pad = {"padx": 12, "pady": 6}
        header = ttk.Frame(self.root)
        header.pack(fill="x", **pad)
        ttk.Label(header, text="DevFridge World Creator", font=("Segoe UI", 16, "bold")).pack(anchor="w")
        ttk.Label(
            header,
            text="Discord + AI 3D. I personaggi sono GLB Three.js in stile cucina PASTA/CAST. Incolla la Meshy API key sotto.",
        ).pack(anchor="w")

        form = ttk.Frame(self.root)
        form.pack(fill="x", **pad)
        last_group = ""
        row = 0
        for group, key, label, secret in FIELDS:
            if group != last_group:
                ttk.Label(form, text=group, font=("Segoe UI", 10, "bold")).grid(
                    row=row, column=0, columnspan=2, sticky="w", pady=(10, 2)
                )
                row += 1
                last_group = group
            ttk.Label(form, text=label).grid(row=row, column=0, sticky="w", padx=(0, 8), pady=3)
            var = StringVar()
            self.vars[key] = var
            if key in COMBOS:
                combo = ttk.Combobox(form, textvariable=var, values=COMBOS[key], width=69, state="readonly")
                combo.grid(row=row, column=1, sticky="ew", pady=3)
            else:
                entry = ttk.Entry(form, textvariable=var, width=72, show="*" if secret else "")
                entry.grid(row=row, column=1, sticky="ew", pady=3)
                self.entries[key] = entry
            form.columnconfigure(1, weight=1)
            row += 1

        opts = ttk.Frame(self.root)
        opts.pack(fill="x", **pad)
        ttk.Checkbutton(
            opts,
            text="Mostra token / chiavi",
            variable=self.show_secrets,
            command=self._toggle_secrets,
        ).pack(side="left")

        actions = ttk.Frame(self.root)
        actions.pack(fill="x", **pad)
        ttk.Button(actions, text="Salva .env", command=self.save).pack(side="left", padx=4)
        ttk.Button(actions, text="Ricarica", command=self.reload).pack(side="left", padx=4)
        ttk.Button(actions, text="Avvia bot", command=self.start_bot).pack(side="left", padx=4)
        ttk.Button(actions, text="Ferma bot", command=self.stop_bot).pack(side="left", padx=4)
        ttk.Button(actions, text="Registra comandi", command=self.register).pack(side="left", padx=4)
        ttk.Button(actions, text="Test AI API", command=self.test_ai).pack(side="left", padx=4)

        links = ttk.Frame(self.root)
        links.pack(fill="x", **pad)
        ttk.Button(links, text="Developer Portal", command=lambda: webbrowser.open(PORTAL)).pack(
            side="left", padx=4
        )
        ttk.Button(links, text="Canale Discord", command=self.open_channel).pack(side="left", padx=4)
        ttk.Button(links, text="Link invita bot", command=self.open_invite).pack(side="left", padx=4)
        ttk.Button(links, text="Apri cartella .env", command=lambda: os.startfile(ROOT)).pack(
            side="left", padx=4
        )

        ttk.Label(self.root, text="Log bot").pack(anchor="w", padx=12)
        self.log = ScrolledText(self.root, height=16, wrap="word", state="disabled")
        self.log.pack(fill="both", expand=True, padx=12, pady=(0, 12))
        self.root.protocol("WM_DELETE_WINDOW", self.on_close)

    def _toggle_secrets(self) -> None:
        visible = self.show_secrets.get()
        for group, key, label, secret in FIELDS:
            if secret and key in self.entries:
                self.entries[key].configure(show="" if visible else "*")

    def append(self, text: str) -> None:
        self.log.configure(state="normal")
        self.log.insert("end", text + "\n")
        self.log.see("end")
        self.log.configure(state="disabled")

    def reload(self) -> None:
        values = load_values()
        for key, var in self.vars.items():
            var.set(values.get(key, ""))
        self.append(f"Caricato {ENV_PATH}")

    def collect(self) -> dict[str, str]:
        values = load_values()
        for key, var in self.vars.items():
            values[key] = var.get().strip()
        return values

    def save(self) -> None:
        values = self.collect()
        ENV_PATH.write_text(dump_env(values), encoding="utf-8")
        missing = [
            k
            for k in ("DISCORD_APPLICATION_ID", "DISCORD_PUBLIC_KEY", "DISCORD_BOT_TOKEN")
            if not values.get(k)
        ]
        if values.get("THREED_PROVIDER", "meshy") != "placeholder" and not values.get("MESHY_API_KEY"):
            missing.append("MESHY_API_KEY (AI 3D — Meshy)")
        if missing:
            messagebox.showwarning(
                "Salvato, ma incompleto",
                "Mancano:\n- " + "\n- ".join(missing) + "\n\nDiscord: Developer Portal. AI 3D: meshy.ai API keys.",
            )
        else:
            messagebox.showinfo("Salvato", f"Parametri scritti in {ENV_PATH.name}")
        self.append(f"Salvato {ENV_PATH}")

    def start_bot(self) -> None:
        self.save()
        values = self.collect()
        if not all(values.get(k) for k in ("DISCORD_APPLICATION_ID", "DISCORD_PUBLIC_KEY", "DISCORD_BOT_TOKEN")):
            return
        if self.proc and self.proc.poll() is None:
            messagebox.showinfo("Bot", "Il bot è già in esecuzione.")
            return
        cmd = tsx() + ["scripts/discord-bot.ts"]
        self.append("> " + " ".join(cmd))
        self.proc = subprocess.Popen(
            cmd,
            cwd=ROOT,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
            creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if os.name == "nt" else 0,
        )
        threading.Thread(target=self._pump, daemon=True).start()

    def _pump(self) -> None:
        assert self.proc and self.proc.stdout
        for line in self.proc.stdout:
            self.root.after(0, self.append, line.rstrip())
        code = self.proc.wait()
        self.root.after(0, self.append, f"bot uscito con codice {code}")

    def stop_bot(self) -> None:
        if not self.proc or self.proc.poll() is not None:
            self.append("Nessun bot in esecuzione.")
            return
        if os.name == "nt":
            subprocess.run(
                ["taskkill", "/F", "/T", "/PID", str(self.proc.pid)],
                capture_output=True,
                text=True,
            )
        else:
            self.proc.send_signal(signal.SIGTERM)
        self.append("Bot fermato.")

    def test_ai(self) -> None:
        self.save()
        values = self.collect()
        provider = values.get("THREED_PROVIDER") or "meshy"
        key = values.get("MESHY_API_KEY") or ""
        if provider == "placeholder":
            messagebox.showinfo("AI 3D", "Provider = placeholder. I personaggi non useranno Meshy.")
            return
        if not key:
            messagebox.showwarning("AI 3D", "Incolla MESHY_API_KEY, poi Salva e Test AI API.")
            return
        threading.Thread(target=self._test_meshy, args=(key,), daemon=True).start()

    def _test_meshy(self, key: str) -> None:
        req = Request(
            "https://api.meshy.ai/openapi/v1/image-to-3d",
            method="GET",
            headers={"Authorization": f"Bearer {key}"},
        )
        try:
            with urlopen(req, timeout=20) as res:
                code = res.status
            detail = f"Meshy reachable ({code})"
            ok = True
        except HTTPError as exc:
            ok = exc.code not in (401, 403)
            detail = f"Meshy HTTP {exc.code}"
        except URLError as exc:
            ok = False
            detail = str(exc.reason)
        except Exception as exc:  # noqa: BLE001
            ok = False
            detail = str(exc)
        self.root.after(0, self.append, f"Test AI API: {detail}")
        if ok:
            self.root.after(0, lambda: messagebox.showinfo("AI 3D", f"Meshy API ok.\n{detail}"))
        else:
            self.root.after(0, lambda: messagebox.showerror("AI 3D", f"Meshy API failed.\n{detail}"))

    def register(self) -> None:
        self.save()
        cmd = tsx() + ["scripts/register-commands.ts"]
        self.append("> " + " ".join(cmd))
        threading.Thread(target=self._run_once, args=(cmd,), daemon=True).start()

    def _run_once(self, cmd: list[str]) -> None:
        try:
            result = subprocess.run(cmd, cwd=ROOT, capture_output=True, text=True)
            out = (result.stdout or "") + (result.stderr or "")
            self.root.after(0, self.append, out.strip() or f"exit {result.returncode}")
        except Exception as exc:  # noqa: BLE001
            self.root.after(0, self.append, str(exc))

    def open_channel(self) -> None:
        guild = self.vars["DISCORD_REVIEW_GUILD_ID"].get().strip() or "1190606959246835764"
        channel = self.vars["DISCORD_CREATOR_CHANNEL_ID"].get().strip() or "1549687923350175784"
        webbrowser.open(f"https://discord.com/channels/{guild}/{channel}")

    def open_invite(self) -> None:
        app_id = self.vars["DISCORD_APPLICATION_ID"].get().strip()
        if not app_id:
            messagebox.showwarning("Invite", "Salva prima l'Application ID.")
            return
        guild = self.vars["DISCORD_REVIEW_GUILD_ID"].get().strip() or "1190606959246835764"
        url = (
            "https://discord.com/oauth2/authorize"
            f"?client_id={app_id}&permissions=52224"
            f"&scope=bot%20applications.commands&guild_id={guild}"
        )
        webbrowser.open(url)

    def on_close(self) -> None:
        if self.proc and self.proc.poll() is None:
            self.stop_bot()
        self.root.destroy()


def main() -> None:
    os.chdir(ROOT)
    root = Tk()
    try:
        root.call("source", "sv")
    except Exception:
        pass
    ttk.Style().theme_use("vista" if sys.platform == "win32" else "clam")
    Dashboard(root)
    root.mainloop()


if __name__ == "__main__":
    main()
