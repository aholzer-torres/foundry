// Get the actor doing the dmg -- if no actor throw error
if (!actor) {
  ui.notifications.error('No actor selected.');
  return;
}

// Ensure someone is targetted ... frankly not using this for anything...
if (canvas.tokens.controlled.length === 0) {
  ui.notifications.error('No target selected.');
  return;
}

// Some constants --
// Die types for dmg
const dmgDice = [4, 6, 8, 10, 12];
// Damage types from the config
const dmgTypes = CONFIG.PF2E.damageTypes;
// Damage categories for special types of damage that need to be handled differently
// These require the @Damage msg to the chat
const dmgCategories = ['', 'persistent', 'precision', 'splash'];

// These are the types of "items" that we both care about and find on the character sheet
// These are the things that might be able to do damage
const itemTypes = {weapon: 'wpn', spell: 'spl'};

// These will comprise the list of things that do damage from the character sheet
let spells = [];
let spellsByLevel = {};
let weapons = [];
let includeWorn = true;

// Import of the damage roller
const DamageRoll = CONFIG.Dice.rolls.find((r) => r.name === 'DamageRoll');

/**
 * Function to prepare the spells and weapons lists for use
 **/
const retrieveSpellsWeapons = () => {
  spells = [];
  spellsByLevel = {};
  weapons = [];

  actor.items.forEach((item) => {
    let add = false;
    if (item.type === 'weapon') {
      const carry = item.system.equipped.carryType;
      if (carry === 'held') {
        weapons.push(item);
      } else if (includeWorn && carry === 'worn') {
        weapons.push(item);
      }
    } else if (item.type === 'spell') {
      const damage = item.system.damage;
      if (typeof damage === "object" && damage !== null && Object.keys(damage).length > 0 ) {
        spells.push(item);
      }
    }
  });

  // sort the weapons
  weapons.sort((a, b) => a.system.slug.localeCompare(b.system.slug));

  // sort the spells
  spells.sort((a, b) => {
    const la = a.system.level.value;
    const lb = b.system.level.value;
    return la === lb ? 
    a.system.slug.localeCompare(b.system.slug) :
    lb - la
  });

  spells.forEach((spell) => {
    const lvl = spell.system.level.value;
    if (!spellsByLevel[lvl]) {
      spellsByLevel[lvl] = [];
    }
    spellsByLevel[lvl].push(spell);
  });

  console.log(weapons);
  console.log(spellsByLevel);
};

/**
 * Create a row of dice. 
 * Includes selecting number of dice, die type, damage type, damage category,
 * also includes a remove row button
 */
const createRow = (cls) => {
  return `
    <div class="${cls}-row" style="display: flex; align-items: right;">
      <input type="number" class="num" value="1" style="margin-right: 5px; width: 50px;">
      <select class="die" style="margin-right: 5px;">
        ${dmgDice
          .map((die) => `<option value="${die}">${die}</option>`)
          .join("")}
      </select>
      <input type="number" class="mod" value="0" style="margin-right: 5px; width: 50px;">
      <select class="damageType" style="margin-right: 5px;">
        ${Object.entries(dmgTypes)
          .map(([key, value]) => `<option value="${key}">${key}</option>`)
          .join('')}
      </select>
      <select class="damageCategory" style="margin-right: 5px;">
        ${dmgCategories
          .map((cat) => `<option value="${cat}">${cat}</option>`)
          .join('')}
      </select>
      <button type="button" class="remove-${cls}-row" style="width: 30px; margin-right: 5px;">-</button>
    </div>`;
};

/**
 * Die formula calculator
 * should probably be renamed from critFormula since it is doing so much more now...
 */
const critFormula = (crits, other, mods = []) => {
  let constant = 0;

  // This is for random modifiers if needed
  mods.forEach((mod) => (constant += mod));

  // Formula collector
  const formulae = [];

  // For each crit die row
  crits.forEach((diceRow) => {
    let formula = '';

    // Figure out if we have dice in the row. If we do then we add the max of the die as a constant to the roll
    if (diceRow.num && diceRow.die) {
      formula = `(${diceRow.num}d${diceRow.die}+${diceRow.num * diceRow.die}+${diceRow.mod})`;
    } else if (diceRow.mod) {
      formula = `${diceRow.mod}`;
    }

    // If there is a damage category we need to do special treatment `((formula)[category])`
    if (diceRow.cat !== '') {
      formula = `((${formula})[${diceRow.cat}])`;
    }

    // Add the damage type in square braces
    if (diceRow.type) {
      formula += `[${diceRow.type}]`;
    } else {
      formula += `[untyped]`;
    }

    // Add to the formula collector
    formulae.push(formula);
  });

  // Non crit damage
  other.forEach((diceRow) => {
    let formula = '';
    // Figure out the dice part
    if (diceRow.num && diceRow.die) {
      formula = `(${diceRow.num}d${diceRow.die}+${diceRow.mod})`;
    } else if (diceRow.mod) {
      formula = `${diceRow.mod}`;
    }
    
    // Properly treat teh damage category
    if (diceRow.cat !== '') {
      formula = `((${formula})[${diceRow.cat}])`;
    }
    
    // Handle the damage type
    if (diceRow.type) {
      formula += `[${diceRow.type}]`;
    } else {
      formula += `[untyped]`;
    }
    formulae.push(formula);
  });

  // Add the constant at the end
  if (constant > 0) {
    formulae.push(constant);
  }

  // Create your dice pool
  const finalFormula = formulae.join(',');
  console.log(finalFormula);
  return finalFormula;
};

/**
 * Function that rolls the die formula separating per line each dice pool
 */
const damageChatRoll = async (formula, msg) => {
  const rolls = await Promise.all(
    formula.split(',')
           .map(r => new DamageRoll(r, actor.getRollData()).roll()));
  ChatMessage.create({
    user: game.user.id,
    type: CONST.CHAT_MESSAGE_TYPES.ROLL,
    rolls,
    speaker: ChatMessage.getSpeaker({ actor: actor }),
    flavor: msg,
  });
};

/**
 * Function to send a msg to the chat w/ @Damage around the formula
 */
const damageChatWithAt = (formula, msg) => {
  const dmgMsg = `@Damage[${formula}]`;
  ChatMessage.create({
    content: dmgMsg,
    flavor: msg,
    speaker: ChatMessage.getSpeaker({ actor: actor }), // Optional: Set the speaker
  });
}

/**
 * Create a dropdown for the items that do damage
 **/
const damagerDropdown = () => {
  retrieveSpellsWeapons();

  // Create weapon options
  let weaponOptions = weapons
    .map((weapon) => `<option value="${itemTypes.weapon}-${weapon.id}">${weapon.name}</option>`)
    .join("");

  // Create spell options with level dividers
  let spellOptions = "";
  for (const level in spellsByLevel) {
    spellOptions += `<option disabled>── Level ${level} ──</option>`;
    spellOptions += spellsByLevel[level]
      .map((spell) => `<option value="${itemTypes.spell}-${spell.id}">${spell.name}</option>`)
      .join("");
  }

  // Construct dropdown
  /* with spells
  let dropdownHtml = `
    <select id="damage-select" name="damage-select">
      <option value="" selected></option>
      <option disabled>──Weapons──</option>
      ${weaponOptions}
      <option disabled>──Spells──</option>
      ${spellOptions}
    </select>
  `;
  */

  let dropdownHtml = `
    <select id="damage-select" name="damage-select">
      <option value="" selected></option>
      <option disabled>──Weapons──</option>
      ${weaponOptions}
    </select>
  `;

  return dropdownHtml;
};

/**
 * Add a populated die row
 **/
const addPopulatedDiceRow = (html, rowType, num, die, type, mod, cat) => {
  const diceRow = createRow(rowType);
  html.find(`#${rowType}-rows`).append(diceRow);
  html.find(`.${rowType}-row`).last().find('.num').val(num);
  html.find(`.${rowType}-row`).last().find('.die').val(die);
  html.find(`.${rowType}-row`).last().find('.damageType').val(type);
  html.find(`.${rowType}-row`).last().find('.mod').val(mod);
  html.find(`.${rowType}-row`).last().find('.damageCategory').val(cat);
  return diceRow;
};

// Create the dialog
new Dialog({
  title: "Crit Damage Roll",
  content: `
    <style>
      /* Remove Button */
      .remove-dice-row, .remove-other-row {
        background-color: #ccc; /* Grayish color */
        border: none;
      }
 
      /* Add Button */
      #add-dice-row, #add-other-row {
        background-color: #3498db; /* Blueish color */
        border: none;
        color: white;
      }
    </style>
    <div>
    ${damagerDropdown()}
    </div>
    <form id="crit-form">
      <div id="dice-rows">
        <label style="margin-right: 5px;">Crit Dice:</label>
      </div>
      <button type="button" id="add-dice-row" style="width: 30px; margin-right: 5px;">+</button>
      <div id="other-rows">
        <label style="margin-right: 5px;">Regular Dice:</label>
      </div>
      <button type="button" id="add-other-row" style="width: 30px; margin-right: 5px;">+</button>
      <div class="form-group">
        <label>Stat Modifier:</label>
        <select id="stat" name="stat">
          <option value="str">Strength</option>
          <option value="dex">Dexterity</option>
          <option value="con">Constitution</option>
          <option value="wis">Wisdom</option>
          <option value="int">Intelligence</option>
          <option value="cha">Charisma</option>
        </select>
      </div>
      <div class="form-group">
        <label>Include Stat Modifier:</label>
        <input type="checkbox" id="includeStat" name="includeStat" checked>
      </div>
      <div class="form-group">
        <label>Additional Modifiers (e.g., 5, -2):</label>
        <input type="text" id="otherMods" name="otherMods" value="">
      </div>
      <div class="form-group">
        <label>Message w/ damage:</label>
        <input type="text" id="msg" value="GOT EM!" style="white-space: normal;">
      </div>
      <div class="form-group">
        <label>Calculated Formula:</label>
        <input type="text" id="formulaDisplay" readonly style="white-space: normal;">
      </div>
    </form>
  `,
  buttons: {
      roll: {
      label: "Crit Roll",
      callback: (html) => {
        const formula = html.find("#formulaDisplay").val();
        const msg = html.find('#msg').val();

        try {
          damageChatRoll(formula, msg);
        } catch (error) {
          ui.notifications.error("Invalid dice formula.");
          console.error(error);
        }
      },
    },
    msg: {
      label: "Crit Msg",
      callback: (html) => {
        // send the msg so that the it uses the damage dialog properly
        const formula = html.find('#formulaDisplay').val();
        const msg = html.find('#msg').val();
        damageChatWithAt(formula, msg);
      }
    },
    cancel: {
      label: "Cancel",
    },
  },
  render: (html) => {
    const diceRows = html.find("#dice-rows");
    const otherRows = html.find("#other-rows");

    html.find("#add-dice-row").on("click", () => {
      diceRows.append(createRow('dice'));
    });

    html.find("#add-other-row").on("click", () => {
      otherRows.append(createRow('other'));
    });

    diceRows.on("click", ".remove-dice-row", function () {
      $(this).closest(".dice-row").remove();
      updateFormula();
    });

    otherRows.on("click", ".remove-other-row", function () {
      $(this).closest(".other-row").remove();
      updateFormula();
    });

    const updateDiceFromWeaponOrSpell = () => {
      const selectedDamage = html.find("#damage-select").val();
      // Clear existing dice rows
      html.find(".dice-row").remove();
      html.find(".other-row").remove();
      if (selectedDamage) {
        const [type, itemId] = selectedDamage.split("-");
        const item = actor.items.get(itemId);
        const system = item.system;

        // TODO use a switch/case statement here for clarity
        if (type === itemTypes.weapon) {
          const damage = system.damage;
          const splashDamage = system.splashDamage;
          const bonusDamage = system.bonusDamage;
          const runes = system.runes;
          const traits = system.traits.value;

          console.log('damage', damage);
          console.log('splash', splashDamage);
          console.log('bonus', bonusDamage);
          console.log('runes', runes);
          console.log('traits', traits);

          if (damage) {
            html.find('#msg').val(`${item.name.toUpperCase()} TO THE FACE!`);
            // Handle damage
            // check if it is deadly. if so we need to do something different
            const deadlyTrait = traits.find((trait) => trait.startsWith('deadly-'));
            if (deadlyTrait) {
              // Handle the striking runes custom rule
              addPopulatedDiceRow(html, 
                                  'other', 
                                  (runes ? damage.dice - runes.striking : damage.dice), 
                                  deadlyTrait.split('-d')[1], 
                                  damage.damageType, 
                                  damage.die.split('d')[1],
                                  ''); 
            } else {
              // Handle the striking runes custom rule
              addPopulatedDiceRow(html, 
                                  'dice', 
                                  (runes ? damage.dice - runes.striking : damage.dice), 
                                  damage.die.split('d')[1], 
                                  damage.damageType, 
                                  0,
                                  '');  
            }

            // Handle persistent damage
            if (damage.persistent) {
              addPopulatedDiceRow(html, 
                                  'dice', 
                                  0, 
                                  damage.die.split('d')[1], 
                                  damage.persistent.type,
                                  damage.persistent.number,
                                  'persistent');
            }

            // handle the striking runes custom rule
            if (runes && runes?.striking > 0) {
              addPopulatedDiceRow(html, 
                                'other', 
                                runes.striking, 
                                damage.die.split('d')[1], 
                                damage.damageType, 
                                0,
                                '');
            }
          }

          // handle splash damage
          if (splashDamage && splashDamage?.value > 0 && damage) {
            addPopulatedDiceRow(html, 
                                'dice', 
                                0, 
                                4, 
                                damage.damageType, 
                                splashDamage.value,
                                'splash');
          }

          // handle bonus damage, whatever the hell that is ??
          if (bonusDamage && bonusDamage?.value > 0 && damage) {
            addPopulatedDiceRow(html, 
                                'other', 
                                bonusDamage?.dice, 
                                bonusDamage?.die.split('d')[1], 
                                damage.damageType, 
                                0,
                                '');
          }
        }
      } else {
        html.find('#msg').val(`TAKE THAT!`);
      }
      updateFormula();
    };

    const updateFormula = () => {
      const critDice = [];
      const diceRows = html.find(".dice-row");
      if(diceRows) {
        diceRows.each(function () {
          const num = parseInt($(this).find(".num").val());
          const die =  $(this).find(".die").val();
          const type = $(this).find(".damageType").val();
          const mod = parseInt($(this).find(".mod").val());
          const category =  $(this).find(".damageCategory").val();
          critDice.push({
            cat: category,
            die: die,
            mod: mod,
            num: num,
            type: type,
          });
        });
      }

      const otherDice = [];
      const otherRows = html.find(".other-row");
      if (otherRows) {
        otherRows.each(function () {
          const num = parseInt($(this).find(".num").val());
          const die = parseInt($(this).find(".die").val());
          const type = $(this).find(".damageType").val();
          const mod = parseInt($(this).find(".mod").val());
          const category =  $(this).find(".damageCategory").val();
          otherDice.push({
            cat: category,
            die: die,
            mod: mod,
            num: num,
            type: type,
          });
        });
      }

      const stat = html.find("#stat").val() || "str";
      const includeStat = html.find("#includeStat").prop("checked");
      const statModifier = actor.system.abilities[stat].mod;

      if (includeStat && critDice.length > 0) {
        critDice[0].mod += statModifier;
      }

      const otherModsStr = html.find("#otherMods").val();
      const otherMods = otherModsStr.split(",").map((mod) => parseInt(mod.trim())).filter((mod) => !isNaN(mod));

      const formula = critFormula(critDice, otherDice, otherMods);

      html.find("#formulaDisplay").val(formula);
    }

    html.find("#stat, .die, .damageType, .damageCategory , input[type='checkbox']").on("change", updateFormula);
    html.find("#damage-select").on("change", updateDiceFromWeaponOrSpell);
    html
      .find("#dice-rows, #other-rows")
      .on("change", ".num, .die, .damageType, .mod, .damageCategory", updateFormula);
    html.find("#add-dice-row, #add-other-row").on("click", updateFormula);
    html.find("#remove-dice-row, #remove-other-row").on("click", updateFormula);
    html.find("#remove-dice-row, #remove-other-row").on("click", updateFormula);
    updateFormula();
  },
}).render(true);