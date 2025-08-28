import { spawn } from 'child_process';
import readline from 'readline';

/*
  Argument Parsing
*/
export const getArgs = (mapping = {}) => {
  const args = {};
  let name = '';
  let values = [];
  
  const save = () => {
    if(name){
      if(values.length === 0){
        args[name] = true;
      } else if(values.length === 1){
        if(values[0] === 'false'){
          args[name] = false;
        } else {
          args[name] = values[0];
        }
      } else {
        args[name] = values;
      }
    }
  };

  for(let i = 2; i < process.argv.length; i++){
    const arg = process.argv[i];
    if(arg.startsWith('-')){
      save();
      if(arg.startsWith('--')){
        name = arg.slice(2);
      } else {
        name = arg.slice(1);
        if(mapping[name]){
          name = mapping[name];
        }
      }
      values = [];
    } else {
      values.push(arg);
    }
  }
  save();
  return args;
};

/*
  Child Process Utilities
*/
export const runChildProcess = command => new Promise((resolve, reject) => {
  const [cmd, ...args] = command.split(' ');
  const child = spawn(cmd, args, { stdio: 'inherit', shell: true });

  child.on('close', code => {
    if(code === 0){
      resolve(`child process exited with code ${code}`);
    } else {
      reject(new Error(`child process exited with code ${code}`));
    }
  });

  child.on('error', reject);
});

export const runChildNodeProcess = (scriptPath, argsObj = {}) => {
  const args = Object.entries(argsObj).flatMap(([key, value]) => {
    if(value === true){
      return [`--${key}`];
    } else {
      return [`--${key}`, value];
    }
  });
  const command = `node ${scriptPath} ${args.join(' ')}`;
  return runChildProcess(command);
};

export const runChildNodeProcessScript = scriptPath => {
  const child = spawn('node', [scriptPath], {
    stdio: 'inherit',
    shell: true
  });
  
  return new Promise((resolve, reject) => {
    child.on('close', code => {
      if(code === 0){
        resolve();
      } else {
        reject(new Error(`Process exited with code ${code}`));
      }
    });
    
    child.on('error', reject);
  });
};

/*
  User Input Utilities
*/
export const promptUser = query => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(`${query}: `, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
};

export const promptYN = (query, defaultValue = 'y') => {
  const formattedQuery = `${query} (${defaultValue === 'y' ? 'Y/n' : 'y/N'}): `;
  return promptUser(formattedQuery).then((answer) => {
    const normalizedAnswer = answer.trim().toLowerCase();
    if (normalizedAnswer === '') {
      return defaultValue === 'y';
    }
    return normalizedAnswer === 'y';
  });
};
