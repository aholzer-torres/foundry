# What & Why
In our home game we have a custom crit rule. We were eternally frustrated when we actually got around to hitting with a critical hit, and then the damage being lower than a normal hit would be. So we decided we would have our own custom crit rule

## Custom Crit rule logic:
1. Damage dice that are included in the crit are maxed and rolled again
    e.g. you attack with a crossbow and critically hit. Normal crit damage is 2d8; custom crit damage is 1d8+8

### Special sub-rule: Striking runes
It was decided that extra damage from striking runes would not be maxed. That is considered bonus damage outside of the crit

# How
I created this macro to give a new modal allowing the user to do what they need

## Manual process
* select dice that will count as "crit" dice, that will be maxed and rolled
* add or not the appropriate stat modifier to the damage
* we have non critical dice in case there are some dice that don't get included in the crit

## Prefill from weapon/item
* use the dropdown to select from the held or worn items (that are weapons & do damage)
* add any additional dice that should be added for other reasons

## Prefill from spell
TODO

# How to install
TODO -- package as an actual module ?

## Prereq
1. You need foundry installed
2. You need access to the macro directory

## Instructions
1. Open the macro directory
2. Create a new macro
3. Copy the text of the macro into the text field
4. Give it a name for ease of finding
5. (Optional) give it an icon you'll recognize
