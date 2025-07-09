export default (args, flagDefaults = {}, flagMap = {}) => {
  const flags = { ...flagDefaults };
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    // Handle long flags (--flag)
    if (arg.startsWith('--')) {
      const flag = arg.substring(2);
      const nextArg = args[i + 1];
      
      if (!nextArg || nextArg.startsWith('-')) {
        flags[flag] = true;
      } else {
        flags[flag] = nextArg;
        i++; // Skip the next argument as it's the value
      }
    } 
    // Handle short flags (-f)
    else if (arg.startsWith('-')) {
      const shortFlag = arg.substring(1);
      const flag = flagMap[shortFlag] || shortFlag;
      const nextArg = args[i + 1];
      
      if (!nextArg || nextArg.startsWith('-')) {
        flags[flag] = true;
      } else {
        flags[flag] = nextArg;
        i++; // Skip the next argument as it's the value
      }
    }
  }
  
  return flags;
}