/** Vietnamese, accent-insensitive search over the source-book records. */

export function normalizeText(value) {
  return String(value ?? "")
    .replace(/[đĐ]/g, "d")
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

const join = (values) => values.filter((value) => value != null && value !== "").join(" ");
const list = (value) => Array.isArray(value) ? value : [];

function ordinalOf(recipe, position) {
  const ordinal = Number(recipe.ordinal);
  return Number.isFinite(ordinal) && ordinal > 0 ? ordinal : position + 1;
}

/**
 * Build once after loading book.json. Recipe objects are not copied or mutated.
 * The returned index is intentionally opaque to callers.
 */
export function createSearchIndex(book = {}) {
  const categories = new Map(list(book?.categories).map((item) => [item.id, item]));
  const subcategories = new Map(list(book?.subcategories).map((item) => [item.id, item]));
  const records = list(book?.recipes).map((recipe, position) => {
    const category = categories.get(recipe.categoryId) ?? {};
    const subcategory = subcategories.get(recipe.subcategoryId) ?? {};
    const sectionRows = list(recipe.sections);
    const ingredientRows = list(recipe.ingredients);
    const title = normalizeText(join([recipe.title, recipe.headingText]));
    const categoryText = normalizeText(join([recipe.categoryName, category.name, category.title]));
    const subgroupText = normalizeText(join([recipe.subcategory, subcategory.name, subcategory.title]));
    const uses = normalizeText(join([
      recipe.usageSummary,
      ...sectionRows
        .filter((section) => ["uses", "effects"].includes(section.kind)
          || ["chu tri", "tac dung", "cong dung"].includes(normalizeText(section.label)))
        .map((section) => section.text),
    ]));
    const ingredientNames = ingredientRows.map((ingredient) => normalizeText(ingredient.name));
    const ingredients = normalizeText(join([
      recipe.ingredientsText,
      ...sectionRows
        .filter((section) => section.kind === "ingredients" || normalizeText(section.label) === "thanh phan")
        .map((section) => section.text),
      ...ingredientRows.map((ingredient) => join([ingredient.name, ingredient.quantity])),
    ]));
    const all = normalizeText(join([
      title,
      categoryText,
      subgroupText,
      recipe.sourceText,
      ...list(recipe.rawLines).map((line) => line.text),
      ...sectionRows.map((section) => join([section.label, section.text])),
      ingredients,
    ]));
    return {
      recipe,
      position,
      ordinal: ordinalOf(recipe, position),
      title,
      categoryText,
      subgroupText,
      uses,
      ingredientNames,
      ingredients,
      haystacks: {
        all,
        uses: normalizeText(join([uses, categoryText, subgroupText])),
        ingredients,
      },
    };
  });
  return { records };
}

function parseQuery(value) {
  const raw = String(value ?? "");
  const phrases = [];
  // Both keyboard quotes and Vietnamese typographic quotes are accepted.
  const remainder = raw.replace(/["“]([^"”]*)["”]/g, (_match, phrase) => {
    const normalized = normalizeText(phrase);
    if (normalized) phrases.push(normalized);
    return " ";
  });
  const fullText = normalizeText(raw);
  const tokens = [...new Set(normalizeText(remainder).split(" ").filter(Boolean))];
  return { tokens, phrases: [...new Set(phrases)], fullText };
}

function wholePhrase(haystack, phrase) {
  return phrase !== "" && (` ${haystack} `).includes(` ${phrase} `);
}

function matches(record, mode, query) {
  const haystack = record.haystacks[mode];
  return query.tokens.every((token) => haystack.includes(token))
    && query.phrases.every((phrase) => wholePhrase(haystack, phrase));
}

function relevance(record, mode, query) {
  if (!query.fullText) return 0;
  const phrase = query.fullText;
  const tokens = [...new Set([...query.tokens, ...query.phrases.flatMap((item) => item.split(" "))])];
  let score = wholePhrase(record.haystacks[mode], phrase) ? 30 : 0;
  if (mode === "all" && wholePhrase(record.title, phrase)) score += 210;
  if (mode !== "ingredients") {
    if (wholePhrase(record.uses, phrase)) score += 180;
    if (wholePhrase(record.categoryText, phrase)) score += 80;
    if (wholePhrase(record.subgroupText, phrase)) score += 90;
  }
  if (mode !== "uses") {
    if (record.ingredientNames.some((name) => name === phrase)) score += 260;
    else if (record.ingredientNames.some((name) => wholePhrase(name, phrase))) score += 170;
    if (wholePhrase(record.ingredients, phrase)) score += 100;
  }
  for (const token of tokens) {
    if (mode !== "ingredients" && record.uses.includes(token)) score += 9;
    if (mode !== "uses" && record.ingredients.includes(token)) score += 7;
    if (mode === "all" && record.title.includes(token)) score += 5;
    if (mode !== "ingredients" && record.subgroupText.includes(token)) score += 3;
    if (mode !== "ingredients" && record.categoryText.includes(token)) score += 2;
  }
  return score;
}

/**
 * All normalized query terms use AND semantics. A double-quoted phrase must
 * occur contiguously. Unquoted terms allow partial words while typing.
 *
 * mode "all": original source text, category and subgroup.
 * mode "uses": uses/effects sections, category and subgroup only.
 * mode "ingredients": source ingredient paragraphs, names and quantities only.
 *
 * favoriteIds null/undefined means no favorite filter. An empty Set/array
 * deliberately produces no results. sort "book" always uses source order;
 * relevance ties also use source order. Returns original recipe references.
 */
export function searchRecipes(index, options = {}) {
  const settings = options ?? {};
  const mode = ["all", "uses", "ingredients"].includes(settings.mode) ? settings.mode : "all";
  const query = parseQuery(settings.query ?? "");
  const favoriteIds = settings.favoriteIds instanceof Set
    ? settings.favoriteIds
    : Array.isArray(settings.favoriteIds) ? new Set(settings.favoriteIds) : null;
  const results = [];
  for (const record of list(index?.records)) {
    const recipe = record.recipe;
    if (settings.categoryId && recipe.categoryId !== settings.categoryId) continue;
    if (settings.subcategoryId && recipe.subcategoryId !== settings.subcategoryId) continue;
    if (["recipe", "reference"].includes(settings.kind)
      && (recipe.kind || "recipe") !== settings.kind) continue;
    if (favoriteIds !== null && !favoriteIds.has(recipe.id)) continue;
    if (!matches(record, mode, query)) continue;
    results.push({ record, score: settings.sort === "book" ? 0 : relevance(record, mode, query) });
  }
  results.sort((a, b) => b.score - a.score
    || a.record.ordinal - b.record.ordinal
    || a.record.position - b.record.position);
  return results.map(({ record }) => record.recipe);
}
