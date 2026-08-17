# Migrations

Usually empty, and that is the point.

The schema is additive: a new field arrives optional with a default that
makes older files correct rather than merely tolerated, and nothing is ever
renamed or repurposed. Almost every change to Docket therefore needs nothing
here, and your data keeps working untouched.

A migration exists only for the rare change that additive rules cannot cover.
When one ships, `npm run migrate` tells you it is pending, shows every file it
would touch, and changes nothing until you run it with `--apply`. It writes
files and stops, so `git diff` shows exactly what happened and `git checkout .`
undoes all of it.

Running one is optional. The engine reads unmigrated data correctly. A
migration tidies; it never rescues.

See the top of `scripts/migrate.mjs` for how to write one.
