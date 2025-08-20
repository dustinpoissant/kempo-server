# Code Contribution Guidelines

## Project Structure

 - All code should be in the `src/` directory, with the exception of index.js.
 - All utility function module files should be in the `src/utils/` directory.

### GUI

All files served by the GUI should be in the `gui/` directory, with the exception of scripts shared with the CLI, custom endpoints, and node_modules like essential.css (which should have custom endpoints).

## Coding Style Guidelines

### Code Organization
Use multi-line comments to separate code into logical sections. Group related functionality together.
  - Example: In Lit components, group lifecycle callbacks, event handlers, public methods, utility functions, and rendering logic separately.

```javascript
/*
  Lifecycle Callbacks
*/
```

### Avoid single-use variables/functions
Avoid defining a variable or function to only use it once; inline the logic where needed. Some exceptions include:
  - recursion
  - scope encapsulation (IIFE)
  - context changes

### Minimal Comments, Empty Lines, and Spacing

Use minimal comments. Assume readers understand the language. Some exceptions include:
  - complex logic
  - anti-patterns
  - code organization

Do not put random empty lines within code; put them where they make sense for readability, for example:
  - above and below definitions for functions and classes.
  - to help break up large sections of logic to be more readable. If there are 100 lines of code with no breaks, it gets hard to read.
  - above multi-line comments to indicate the comment belongs to the code below

No  empty lines in css.

End each file with an empty line.

End each line with a `;` when possible, even if it is optional.

Avoid unnecessary spacing, for example:
  - after the word `if`
  - within parentheses for conditional statements

```javascript
let count = 1;

const incrementOdd = (n) => {
  if(n % 2 !== 0){
    return n++;
  }
  return n;
};

count = incrementOdd(count);
```

### Prefer Arrow Functions
Prefer the use of arrow functions when possible, especially for class methods to avoid binding. Use normal functions if needed for preserving the proper context.
 - For very basic logic, use implicit returns
 - If there is a single parameter, omit the parentheses.
```javascript
const addOne = n => n + 1;
```

### Module Exports
  - If a module has only one export, use the "default" export, not a named export.
    - Do not declare the default export as a const or give it a name; just export the value.

```javascript
export default (n) => n + 1;
```
  - If a module has multiple exports, use named exports and do not use a "default" export.

### Code Reuse
Create utility functions for shared logic.
  - If the shared logic is used in a single file, define a utility function in that file.
  - If the shared logic is used in multiple files, create a utility function module file in `src/utils/`.

### Naming
Do not prefix identifiers with underscores.
  - Never use leading underscores (`_`) for variable, property, method, or function names.
  - Use clear, descriptive names without prefixes.
  - When true privacy is needed inside classes, prefer native JavaScript private fields (e.g., `#myField`) instead of simulated privacy via underscores.

## Lit Components

### Component Architecture and Communication

- Prefer direct method calls to trigger behavior. Do not dispatch custom events to make something happen. Use events only to inform that something already happened.
  - Do: `this.closest('ktf-test-framework').enqueueTest({...});`
  - Don’t: `this.closest('ktf-test-framework').dispatchEvent(new CustomEvent('enqueue', {...}))` to trigger logic.

- Containment-first design: place orchestrators (e.g., `ktf-test-framework`) as a parent that wraps all dependent components (summary, suites, tests). Children should locate the parent with `closest('ktf-test-framework')` and call its methods.
  - Parents may query their own subtree (`this.querySelectorAll(...)`) to find children.

- Avoid window globals and window-scoped events for app logic. Scope cross-component events to the containing framework element when possible. Window events are reserved for process-wide concerns (e.g., settings store changes).

- Status and UI mapping: queued status should render the `scheduled` icon; running may use spin animation.

