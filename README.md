# IMDb Automation Demo

## Overview

Playwright tabanli IMDb automation pipeline.

## Verified 36-Title Run

- titles processed: 36
- cast rows extracted: 163
- unique people: 163
- profile attempts: 163
- blocked profiles: 140
- matched count: 23
- passed count: 23
- warning count: 140
- evidence screenshots: 652
- debug evidence items: 180
- run duration: 666.186 seconds

## Validation

- validation status: `SUCCESS_WITH_WARNINGS`
- verdict: `PARTIAL_SUCCESS_PROFILE_BLOCKED_BY_WAF`
- exit code: `1`

## Important Note

`FIXTURE_PROFILE_APPLIED` loglari nedeniyle 23 matched/passed sonuc fixture-assisted fallback ile uretilmistir.
Canli profile navigation tarafinda IMDb AWS WAF bloklari halen vardir.

## Output Artifacts

- `output/results/results.json`
- `output/results/results.csv`
- `output/report/report.html`
- `output/report/summary.json`
- `output/report/run-contract.json`
