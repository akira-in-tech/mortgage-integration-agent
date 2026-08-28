const PLACEHOLDER_PATTERN = /\{\{(\w+)\}\}/g;

export interface RenderResult {
  content: string;
  missingVariables: string[];
  unknownVariables: string[];
}

/**
 * Pure substitution — no free-form concatenation, ever: the output is
 * exactly `bodyTemplate` with `{{variableName}}` placeholders replaced by
 * the matching supplied value. A placeholder with no supplied value is
 * left visibly unsubstituted (not silently dropped or blanked) so a
 * reviewer can see exactly what's missing; the caller (the classifier)
 * treats any `missingVariables` as a reason to fail closed to
 * `PROTECTED`.
 */
export function renderTemplate(
  bodyTemplate: string,
  allowedVariables: string[],
  variables: Record<string, string>,
): RenderResult {
  const allowedSet = new Set(allowedVariables);
  const unknownVariables = Object.keys(variables).filter(
    (key) => !allowedSet.has(key),
  );
  const missingVariables: string[] = [];
  const content = bodyTemplate.replace(
    PLACEHOLDER_PATTERN,
    (match: string, key: string) => {
      if (!(key in variables)) {
        missingVariables.push(key);
        return match;
      }
      return variables[key];
    },
  );
  return { content, missingVariables, unknownVariables };
}
