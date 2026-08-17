# The support callout

A card for your own product's site, linking to your support centre. Copy
`callout.html` onto any page, change the four things marked in it, and it is
done. No build step, no script, no request to anything.

It is here because a support centre nobody can find is a support centre
nobody uses, and the place people look is the product's own site.

## What to change

| Change | To |
|---|---|
| `https://support.example.com` | your support centre |
| `Example Co` | your product's name |
| `--dk-accent` | your colour |
| The three links | whichever sections you actually have |

## Fitting in

The card takes its type from whatever surrounds it, on purpose: it should
look like part of your site, not like something pasted onto it. If your page
sets a font, the card uses it.

Colours are the one thing it sets for itself, because it cannot guess yours.
There is a dark-mode block at the bottom driven by `prefers-color-scheme`; if
your site switches theme with a class or an attribute instead, change that
one selector to match and everything else follows.
