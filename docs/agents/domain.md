# Domain Notes

## Ubiquitous Language

- **Branch Goal**: Markdown description of what the branch is trying to achieve.
- **Context Pack**: The bounded context sent to AI: current file, diff, branch goal, assisted memory, and budget metadata.
- **Patch Proposal**: AI-generated structured edit proposal. It is not applied automatically.
- **Structured Edit Operation**: A safe edit shape with `file`, `find`, `replacement`, and `reason`.
- **Patch Queue**: Holding area for proposed edits before user review.
- **Diff Review**: Monaco diff view used before applying patch or creating commit.
- **Safety Gate**: Soft gate that checks branch goal, context, model capability, patch review, tests, commit draft, PR draft, and unresolved warnings.
- **Recorded AI**: Deterministic demo fallback so the portfolio demo works without model setup.
- **WebLLM**: Browser-local model path for small tasks.
- **Ollama fallback**: Local desktop model path for larger tasks.
- **Runtime Plan**: Detected execution capability, such as WebContainer candidate or recorded fallback.

## Safety Principles

- AI never writes directly to Git history.
- AI output should become structured data first.
- User reviews diff before applying.
- Commit and PR creation are gated by visible checks.
- Local/private code must stay local unless the user explicitly uses GitHub integration.

## Data Ownership

Browser:

- workspace files
- local snapshots
- context pack
- model execution state

Worker / D1:

- workflow metadata
- repository metadata
- PR URL
- safety gate summary

GitHub:

- repository source
- branch
- commit
- PR

## Demo Boundary

Demo mode is a first-class product mode. It exists to make the portfolio review reliable. It must be labeled as demo and should not be described as real GitHub, WebLLM, Ollama, or WebContainer execution.
