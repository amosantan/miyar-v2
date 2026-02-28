const { spawn } = require('child_process');

const proc = spawn('npx', ['drizzle-kit', 'push'], {
    cwd: '/Users/amrosaleh/Maiyar/miyar-v2',
    env: { ...process.env, FORCE_COLOR: '0' }
});

let state = 0;

proc.stdout.on('data', (data) => {
    const out = data.toString();
    process.stdout.write(out);

    // Prompt 1: material_constants truncate warning
    if (out.includes('Do you want to truncate material_constants table?')) {
        console.log('--- Sending ENTER for prompt 1 ---');
        proc.stdin.write('\r'); // Default is No
    }

    // Prompt 2: Data loss warning
    if (out.includes('Do you still want to push changes?')) {
        console.log('--- Sending DOWN ARROW then ENTER for prompt 2 ---');
        // Escape sequence for Down Arrow (\x1B[B) then Enter (\r)
        proc.stdin.write('\x1B[B\r');
    }
});

proc.stderr.on('data', (data) => {
    console.error(data.toString());
});

proc.on('close', (code) => {
    console.log(`drizzle-kit push exited with code ${code}`);
    process.exit(code);
});
