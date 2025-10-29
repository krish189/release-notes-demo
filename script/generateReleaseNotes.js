const fs = require('fs'); // File System Module
const { Octokit } = require('@octokit/rest'); // GitHub's Official REST API Client

// Read environment variables provided by GitHub Actions
const token = process.env.GITHUB_TOKEN; // Auth Token for API Calls
const repoName = process.env.GITHUB_REPOSITORY; // Repo name in Owner/Repo format
const eventPath = process.env.GITHUB_EVENT_PATH; // Path to JSON file containing event details (PR info)

// Initialize Octokit
const octokit = new Octokit({ auth: token }); // Creating an authenticated Octokit Instance
const [owner, repo] = repoName.split('/'); // Splitting owner/repo into owner and repo

// Load the event payload (contains PR details)
const event = JSON.parse(fs.readFileSync(eventPath, 'utf8')); // Reads the JSON file at eventPath and parses it
const pr = event.pull_request;

// Function to generate release notes
async function generateReleaseNotes() {
  try {
    // Fetch commits associated with the PR
    const commits = await octokit.pulls.listCommits({
      owner,
      repo,
      pull_number: pr.number,
    });

    // Fetch changed files associated with the PR
    const files = await octokit.pulls.listFiles({
      owner,
      repo,
      pull_number: pr.number,
    });
    
    // Build release notes content
    // # - Heading Level 1, ## - Heading Level 2, ** - Bold, * - Italic
    const notes = `
    ## Release Notes
    **PR Number:** #${pr.number}
    **PR Title:** ${pr.title}
    **Description:** ${pr.body || 'No description provided'}
    **Author:** ${pr.user.login}
    **Merged By:** ${pr.merged_by.login}
    **Merged At:** ${pr.merged_at}
    **Base Branch:** ${pr.base.ref}
    **Head Branch:** ${pr.head.ref}
    **Labels:** ${(pr.labels || []).map(label => label.name).join(', ') || 'None'}
    **Milestone:** ${pr.milestone ? pr.milestone.title : 'None'}
    **Merge Commit SHA**: ${pr.merge_commit_sha}
    
    ### Commits:
    ${commits.data.map(c => `- ${c.commit.message}`).join('\n')}
    
    ### Files Changed:
    ${files.data.map(f => `- ${f.filename}`).join('\n')}

    **Summary:**
    - Total Commits: ${commits.data.length}
    - Total Files Changed: ${files.data.length}
    `;

    // Write to a markdown file
    fs.writeFileSync('release-notes.md', notes);
    console.log('Release notes generated successfully!');

    // Display Release Note Details in Releases Section of GitHub Homepage
    const prTitle = pr.title;
    const tagName = prTitle.split(' ')[1];
    const tag = prTitle.includes('Release') ? tagName : `v${new Date().toISOString().split(".")[0].replaceAll("-","").replaceAll(":","").replace("T","")}`; 
    
    // Posting data for creating new release
    await octokit.repos.createRelease({
      owner,
      repo,
      tag_name: tag,
      name: `Release ${tag}`,
      body: pr.body,
      draft: false,
      prerelease: false,
    });

    console.log("Release Details added to Releases Section in GitHub Homepage successfully");
  } catch (error) {
    console.error('Error generating release notes:', error);
    process.exit(1);
  }
}

// Call the function
generateReleaseNotes();