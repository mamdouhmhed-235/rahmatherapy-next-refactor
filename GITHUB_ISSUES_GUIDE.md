# GitHub Issues & Workflow Guide for AI Agents

**Objective**: Maintain a rigorous, transparent, and up-to-date history of all work, decisions, and progress to ensure the human team has complete visibility.

## ⚠️ Prime Directive
**No code changes are committed without a corresponding GitHub Issue.** Taking 30 seconds to track work saves hours of confusion later. 

### Core Agent Directives
1. **No Ghost Coding**: Never write code or make architectural changes without an associated open GitHub issue.
2. **Be Atomic**: Keep issues scoped to single, manageable features or bug fixes. Break massive overhauls into multiple smaller issues.
3. **Use the MCP Tools**: Rely heavily on the `github-mcp-server` to stay synchronized with the repository's state.

---

## 1. Initialization (Start of Task)

Before writing any code or planning detailed implementation, follow this discovery and creation lifecycle:

1. **Search**: Look for existing issues related to the user's request.
   * *Tool*: `mcp_github-mcp-server_search_issues`
   * *Action*: If a relevant issue is found, use `mcp_github-mcp-server_issue_read` to read its current state, comments, and requirements.
2. **Create (if not found)**: Create a new issue if one does not exist.
   * *Tool*: `mcp_github-mcp-server_issue_write` (method: `create`)
3. **Update (if found)**: If an issue exists but is outdated, update it with new context.
   * *Tool*: `mcp_github-mcp-server_issue_write` (method: `update`)

### Issue Structure Template
When creating an issue, use this structure:

**Title**: `[Type] Concise Description`
*Types*: `Feature`, `Bug`, `Refactor`, `Docs`, `Chore`

**Body**:
```markdown
## Objective
[Brief description of what needs to be achieved]

## Acceptance Criteria
- [ ] Criterion 1 (e.g., Page loads without errors)
- [ ] Criterion 2 (e.g., User can click X)

## Technical Notes
- [Optional: Brief note on implementation strategy, e.g., "Using generic-ui library"]
```

---

## 2. Execution (During Work)

As you make significant progress, you must keep the issue updated and follow repository conventions.

* **Issue Updates**: Use the `mcp_github-mcp-server_add_issue_comment` tool to log major decisions, unexpected hurdles, or the completion of sub-tasks.
* **Branching**: Specific branches should be created for the issue.
  * *Naming Convention*: `feat/issue-ID-short-description` or `fix/issue-ID-short-description`.
* **Commits**: All commit messages must reference the issue ID.
  * *Format*: `[#ISSUE_ID] Commit message` (e.g., `[#12] Add responsive styles to header`)
* **PR Linking**: If you use tools to create a Pull Request, you **must** include "Fixes #[issue_number]" or "Resolves #[issue_number]" in the PR body so GitHub links them automatically.

---

## 3. Completion (End of Task)

1. **Verification**: Ensure all Acceptance Criteria are met and the user is satisfied.
2. **Closing**: Close the issue using the GitHub tool.
   * *Tool*: `mcp_github-mcp-server_issue_write` (method: `update`, state: `closed`)
3. **Comment**: Add a final comment summarizing the resolution if it wasn't a standard PR merge (optional but recommended for complex tasks).
   * *Tool*: `mcp_github-mcp-server_add_issue_comment`

---

## 4. Standard Labels

Apply these labels when creating or updating issues:
* `enhancement`: New features or improvements.
* `bug`: Errors or broken functionality.
* `documentation`: Changes to README, guides, or code comments.
* `refactor`: Code cleanup without logic change.
* `urgent`: Blocks critical workflows.

---

## 5. Agent Instructions (System Prompt Injection)

*When you (the AI Agent) read this file, you must:*
1. Acknowledge that you will track your work.
2. Ask the user for the specific Issue ID if you cannot find one, or ask for permission to create it.
3. Update the issue status as you progress.
