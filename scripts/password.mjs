import { createInterface } from 'node:readline';
import { hashSecret } from '../server/security.mjs';
if (!process.stdin.isTTY) { console.error('Execute em um terminal interativo.'); process.exit(1); }
const rl = createInterface({ input:process.stdin, output:process.stdout, terminal:true });
// Disable terminal echo while the password is read; no password in shell history.
rl.stdoutMuted = true;
rl._writeToOutput = function (text) { if (!this.stdoutMuted) process.stdout.write(text); };
process.stdout.write('Senha administrativa (mínimo 12 caracteres; entrada oculta): ');
rl.question('', password => {
  rl.close(); process.stdout.write('\n');
  if (password.length < 12 || password.length > 200) { console.error('Use de 12 a 200 caracteres.'); process.exitCode = 1; return; }
  console.log(`ADMIN_PASSWORD_HASH=${hashSecret(password)}`);
});
