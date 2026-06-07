// validar-ceps.js
// Uso: node validar-ceps.js
// Requer Node.js 18+ (fetch nativo)

const ESTADOS = [
  { uf: "AC", nome: "Acre",                ranges: [[69900, 69999]] },
  { uf: "AL", nome: "Alagoas",             ranges: [[57000, 57999]] },
  { uf: "AM", nome: "Amazonas",            ranges: [[69000, 69299], [69400, 69899]] },
  { uf: "AP", nome: "Amapá",               ranges: [[68900, 68999]] },
  { uf: "BA", nome: "Bahia",               ranges: [[40000, 48999]] },
  { uf: "CE", nome: "Ceará",               ranges: [[60000, 63999]] },
  { uf: "DF", nome: "Distrito Federal",    ranges: [[70000, 73699]] },
  { uf: "ES", nome: "Espírito Santo",      ranges: [[29000, 29999]] },
  { uf: "GO", nome: "Goiás",               ranges: [[72800, 73799], [74000, 76799]] },
  { uf: "MA", nome: "Maranhão",            ranges: [[65000, 65999]] },
  { uf: "MG", nome: "Minas Gerais",        ranges: [[30000, 39999]] },
  { uf: "MS", nome: "Mato Grosso do Sul",  ranges: [[79000, 79999]] },
  { uf: "MT", nome: "Mato Grosso",         ranges: [[78000, 78899]] },
  { uf: "PA", nome: "Pará",                ranges: [[66000, 68899]] },
  { uf: "PB", nome: "Paraíba",             ranges: [[58000, 58999]] },
  { uf: "PE", nome: "Pernambuco",          ranges: [[50000, 56999]] },
  { uf: "PI", nome: "Piauí",               ranges: [[64000, 64999]] },
  { uf: "PR", nome: "Paraná",              ranges: [[80000, 87999]] },
  { uf: "RJ", nome: "Rio de Janeiro",      ranges: [[20000, 28999]] },
  { uf: "RN", nome: "Rio Grande do Norte", ranges: [[59000, 59999]] },
  { uf: "RO", nome: "Rondônia",            ranges: [[76800, 76999]] },
  { uf: "RR", nome: "Roraima",             ranges: [[69300, 69399]] },
  { uf: "RS", nome: "Rio Grande do Sul",   ranges: [[90000, 99999]] },
  { uf: "SC", nome: "Santa Catarina",      ranges: [[88000, 89999]] },
  { uf: "SE", nome: "Sergipe",             ranges: [[49000, 49999]] },
  { uf: "SP", nome: "São Paulo",           ranges: [[1000,  19999]] },
  { uf: "TO", nome: "Tocantins",           ranges: [[77000, 77999]] },
];

function randomCep(estado, tried = new Set()) {
  const range = estado.ranges[Math.floor(Math.random() * estado.ranges.length)];
  const [min, max] = range;
  let cep, attempts = 0;
  do {
    const prefix = Math.floor(Math.random() * (max - min + 1)) + min;
    const suffix = Math.floor(Math.random() * 1000).toString().padStart(3, "0");
    cep = prefix.toString().padStart(5, "0") + suffix;
    attempts++;
  } while (tried.has(cep) && attempts < 500);
  return cep;
}

function formatCep(cep) {
  return cep.replace(/(\d{5})(\d{3})/, "$1-$2");
}

function pad(str, len) {
  return String(str).padEnd(len, " ");
}

async function consultarCep(cep) {
  const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`, {
    headers: { "Accept": "application/json" },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (data.erro) throw new Error("CEP não encontrado");
  return data;
}

async function encontrarCepValido(estado) {
  const tried = new Set();
  let tentativas = 0;

  while (true) {
    const cep = randomCep(estado, tried);
    tried.add(cep);
    tentativas++;

    process.stdout.write(
      `\r  ${pad(estado.uf, 4)} ${pad(formatCep(cep), 12)} tentativa #${tentativas}   `
    );

    try {
      const data = await consultarCep(cep);
      const localidade = `${data.localidade}/${data.uf}`;
      console.log(
        `\r  ✅ ${pad(estado.uf, 4)} ${formatCep(cep)}  →  ${pad(localidade, 30)} (${tentativas} tentativa${tentativas > 1 ? "s" : ""})`
      );
      return { cep, localidade, tentativas };
    } catch {
      // CEP inválido — tenta outro após pausa curta
      await new Promise(r => setTimeout(r, 100));
    }
  }
}

async function main() {
  console.log("\n========================================");
  console.log("  ViaCEP Validator — 27 estados do Brasil");
  console.log("========================================\n");

  const resultados = [];
  let totalTentativas = 0;

  // Processa estados em grupos de 4 paralelos para não sobrecarregar a API
  const CHUNK = 4;
  for (let i = 0; i < ESTADOS.length; i += CHUNK) {
    const grupo = ESTADOS.slice(i, i + CHUNK);
    const resultadosGrupo = await Promise.all(grupo.map(e => encontrarCepValido(e)));
    resultados.push(...resultadosGrupo);
    totalTentativas += resultadosGrupo.reduce((a, r) => a + r.tentativas, 0);
  }

  const cepsValidos = resultados.map(r => formatCep(r.cep));

  console.log("\n========================================");
  console.log(`  ${cepsValidos.length}/27 CEPs encontrados | ${totalTentativas} tentativas no total`);
  console.log("========================================\n");

  console.log("const cepsPorEstado = " + JSON.stringify(cepsValidos, null, 2) + ";\n");

  // Salva também em arquivo JSON
  const fs = await import("fs");
  const saida = {
    geradoEm: new Date().toISOString(),
    totalTentativas,
    ceps: ESTADOS.map((e, i) => ({
      uf: e.uf,
      nome: e.nome,
      cep: formatCep(resultados[i].cep),
      localidade: resultados[i].localidade,
      tentativas: resultados[i].tentativas,
    })),
    array: cepsValidos,
  };
  fs.writeFileSync("ceps-validos.json", JSON.stringify(saida, null, 2));
  console.log("  Resultado salvo em ceps-validos.json\n");
}

main().catch(err => {
  console.error("\nErro fatal:", err.message);
  process.exit(1);
});
