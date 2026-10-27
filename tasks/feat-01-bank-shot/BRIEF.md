# Bank shots

*Design spec, combat / scoring*

Walls already bounce the blade, but nothing rewards using them. Players who learn the angles should score for it, and it gives a reason to throw at something other than the nearest enemy.

**Rule.** A kill counts as a **bank shot** if the blade has bounced off a wall at least once during the current throw (on the way out or on the way back). A bank shot scores **double** the normal kill value, after the multiplier.

**Feedback.**
- The kill's score popup is red instead of ink.
- A smaller "bank shot" label pops just above it.
- A short bright tick plays alongside the kill sound.

**Scope.**
- Kills only. Cutting an enemy shot out of the air is unchanged.
- The banked state belongs to one throw: it resets the next time the blade leaves your hand.
- No change to the multiplier, combo or catch rules.
