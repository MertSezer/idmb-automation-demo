# IMDb Automation Demo

## Overview

End-to-end browser automation pipeline for IMDb title pages.

Pipeline flow:

Input URLs
→ Title page navigation
→ Cast extraction
→ Profile visit attempt
→ AWS WAF challenge detection
→ Evidence capture
→ JSON / CSV export
→ HTML report generation
→ Run validation contract

## Verified Behaviour

The automation pipeline successfully completes:

- title page navigation
- cast extraction
- profile URL discovery
- profile visit attempts
- blocked profile detection
- screenshot evidence capture
- JSON / CSV export
- HTML report generation
- validation contract generation

## Current Execution Result

IMDb profile pages are protected by AWS WAF in this environment.

Because of that:

- cast rows are extracted successfully
- profile URLs are discovered
- profile navigation attempts are executed
- WAF challenge pages are detected
- evidence screenshots are captured
- the run ends as a controlled partial success

## Verified Validation Result

PARTIAL_SUCCESS_PROFILE_BLOCKED_BY_WAF

Exit code:

2

## Example Run

npm run start:validated

## Generated Outputs

output/results/results.json
output/results/results.csv
output/report/report.html
output/report/run-contract.json
output/report/summary.json
# IMDb Automation Demo

## Overview

End-to-end browser automation pipeline for IMDb title pages.

Pipeline flow:

Input URLs
-> Title page navigation
-> Cast extraction
-> Profile visit attempt
-> AWS WAF challenge detection
-> Evidence capture
-> JSON / CSV export
-> HTML report generation
-> Run validation contract

## Verified Behaviour

The automation pipeline successfully completes:

- title page navigation
- cast extraction
- profile URL discovery
- profile visit attempts
- blocked profile detection
- screenshot evidence capture
- JSON / CSV export
- HTML report generation
- validation contract generation

## Current Execution Result

IMDb profile pages are protected by AWS WAF in this environment.

Because of that:

- cast rows are extracted successfully
- profile URLs are discovered successfully
- profile visits are attempted successfully
- blocked profile pages are detected correctly
- screenshots and debug evidence are generated correctly
- the run finishes as a controlled partial-success outcome

## Verified Validation Result

`PARTIAL_SUCCESS_PROFILE_BLOCKED_BY_WAF`

Exit code:

`2`

## Example Run

```bash
npm run start:validated
```

## Generated Outputs

- `output/results/results.json`
- `output/results/results.csv`
- `output/report/report.html`
- `output/report/run-contract.json`
- `output/report/summary.json`

## Notes

This is not an unhandled runtime failure.

The current environment allows successful title-page extraction, but IMDb profile pages are blocked by AWS WAF during automated profile navigation. The application detects and reports this as an expected validation outcome.
