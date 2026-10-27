# Reference solution

**Root cause.** The blade tracks which enemies it has already struck in `hitSet`, so a slow blade overlapping a brute for several frames doesn't hit it every frame. The set has to be emptied when the blade turns home, so the return leg can strike the same enemies again. `turnHome()` lost that line, so the set was only cleared at the start of each throw, and every enemy could be hit once per *throw* instead of once per *leg*.

**How to find it by playtesting.** Brutes make it visible: their pips show exactly how many hits landed. Throw straight through one and count white flashes. Mites die on one hit, so the bug is invisible against them, which is why it slipped past casual play.

**Fix** (`reference-solution.patch`): clear `hitSet` in `turnHome()`, which both the natural return and the early recall go through.

```js
turnHome(g, early) {
  this.state = 'return';
  this.hitSet.clear();
  if (early) g.onRecall(this);
}
```

**Rejected alternatives.** Removing `hitSet` altogether makes the blade hit an overlapped enemy every frame. Clearing it only in the recall branch fixes the early recall and leaves the natural return broken; the check covers both paths for that reason.
