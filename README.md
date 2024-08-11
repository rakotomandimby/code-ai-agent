# Create a new Node + Express + TypeScript project


```bash
mkdir code && cd code
npm init -y
npm install --save express typescript @types/express @types/node ts-node ts-node-dev
npx tsc --init
```

# Setup a build target directory

In the file `tsconfig.json`, uncomment the `outDir` property and set it to `./dist`:

```json
{
  ...
  "compilerOptions": {
    ...
        "outDir": "./dist",
    ...
  }
  ...
}
```

# Setup usual commands 

In `package.json`:

```json
{
  ...
  "scripts": {
    "build": "tsc",
    "start": "tsc && node dist/index.js"
  }
  ...
}
```
