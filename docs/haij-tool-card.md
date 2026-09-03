# Ajour on haij.dk

Copy for the tool card on the family's front page, and a note on the entry
in the site's own `tools.ts`. Nothing here is code for this repository:
haij.dk is its own repo, and this file is the proposal to paste from.

## The card

**Ajour** · ajour.haij.dk

**Danish, one line**

> Holder små projekter opdaterede. AI'en samler op, skriver ugens status og
> foreslår ændringer når virkeligheden flytter sig. Du bestemmer.

**English, one line**

> Keeps small projects up to date. The AI gathers what happened, drafts the
> week's status and proposes changes when reality moves. You decide.

**Danish, the paragraph under it**

> De fleste projektværktøjer er bygget til at lægge planer. Ajour er bygget
> til at holde dem i live. Beskriv projektet med dine egne ord, og du har en
> plan du kan rette i. Hver uge skriver AI'en et udkast til status ud fra
> det der faktisk er sket, og spørger om det den ikke kan vide. Skrider en
> milepæl, regner den ud hvad der så skal flytte sig, og du siger ja eller
> nej. Der gemmes en kopi af planen før hver ændring, så alt kan fortrydes.
> Til projekter med to til ti mennesker: kundeprojektet, kampagnen,
> renoveringen i andelsforeningen, konferencen der køres af frivillige.

**English, the paragraph under it**

> Most project tools are built to make plans. Ajour is built to keep them
> alive. Describe the project in your own words and you have a plan you can
> edit. Each week the AI drafts the status from what actually happened and
> asks about what it cannot know. When a milestone slips, it works out what
> else has to move, and you say yes or no. A copy of the plan is taken
> before every change, so all of it can be undone. For projects with two to
> ten people: the client project, the campaign, the renovation at the
> housing association, the conference run by volunteers.

**Chips, if the card has them**

Start · Ugen · Skred · Tidslinje · Board · Beslutninger · Statusrapport

**Buttons**

- Primary: _Prøv demoen_ → `https://ajour.haij.dk/demo`
- Secondary: _Ansøg om adgang_ → `https://ajour.haij.dk/register`
- Tertiary, if the card carries one: _Koden_ → `https://github.com/MartinNymannVinther/ajour`

**Status label**

`Klar til brug · v1` in Danish, `Ready to use · v1` in English. Not "beta":
it does what it says. What it has not yet done is run a real project, which
is dogma seven's bar and belongs in the sentence below rather than in a
badge.

## The entry in the site's tools list

The site keeps its tools in a `tools.ts`. The proposed shape, matching the
existing entries rather than inventing a new one:

```ts
{
  id: "ajour",
  name: "Ajour",
  href: "https://ajour.haij.dk",
  repo: "https://github.com/MartinNymannVinther/ajour",
  demo: "https://ajour.haij.dk/demo",
  status: "live",
  tagline: {
    da: "Holder små projekter opdaterede.",
    en: "Keeps small projects up to date.",
  },
  // …description and chips from the copy above
}
```

Two things worth checking against the site rather than assuming: whether
`demo` is a field the card already understands, and whether `status: "live"`
is the value the other tools use for something in production. Match what is
there; do not add a field for one tool.

## What the card should not say

No "powered by AI" as the headline. The AI is how it works, not what it is
for, and every second tool says it. No promises about uptime — the terms
page is honest that there is none, and the card should not contradict it.
No feature list longer than the chips: the omissions are the product, and a
card that lists twenty things is describing a different tool.
