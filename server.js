const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const Groq = require('groq-sdk');
const axios = require('axios');
require('dotenv').config();

const app = express();
app.use(express.json());

/* ================================
   INICIALIZAÇÃO DOS CLIENTES
================================ */

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

/* ================================
   CONFIGURAÇÕES EVOLUTION
================================ */

const EVO_URL = process.env.EVOLUTION_API_URL;
const EVO_KEY = process.env.EVOLUTION_API_KEY;
const EVO_INSTANCE = process.env.EVOLUTION_INSTANCE;

/* ================================
   PROMPT MESTRE NÚCLEO 8
================================ */

const NUCLEO_8_PROMPT = `
Você é um treinador especialista em fisiologia do exercício, biomecânica e periodização do treinamento.

Seu papel é prescrever treinos personalizados utilizando ciência do treinamento e o método proprietário NÚCLEO 8.

O NÚCLEO 8 é um sistema híbrido que integra força e resistência aeróbica focado em:

- longevidade física
- saúde metabólica
- desempenho funcional
- sustentabilidade do treinamento

Princípio central:
"Evolução consistente sem sacrificar recuperação."

REGRAS DO MÉTODO

• Priorizar sustentabilidade
• Evitar fadiga excessiva
• Priorizar recuperação
• Treinos devem poder ser repetidos por semanas

CARDIO

70–80% Zona 2

FORÇA

RPE médio 6–8  
Evitar falha muscular sistemática

FORMATO OBRIGATÓRIO DA RESPOSTA

Treino do dia

Aquecimento

Treino principal

Exercícios complementares

Desaquecimento

Nunca prescrever dietas ou medicamentos.
`;

/* ================================
   ROTA TESTE
================================ */

app.get('/', (req, res) => {
  res.send('Servidor NÚCLEO 8 rodando');
});

/* ================================
   WEBHOOK WHATSAPP
================================ */

app.post('/webhook', async (req, res) => {

  try {

    const body = req.body;

    console.log("Evento recebido:", body.event);

    if (body.event !== "messages.upsert") {
      return res.sendStatus(200);
    }

    const messageData = body.data;

    const remoteJid = messageData.key?.remoteJid;

    const messageText =
      messageData.message?.conversation ||
      messageData.message?.extendedTextMessage?.text;

    if (!remoteJid || !messageText) {
      return res.sendStatus(200);
    }

    const phone = remoteJid.split('@')[0];

    console.log("Mensagem de:", phone);
    console.log("Texto:", messageText);

    /* ================================
       BUSCAR ATLETA NO SUPABASE
    ================================ */

    let { data: atleta, error } = await supabase
      .from('Atletas')
      .select('*')
      .eq('phone', phone)
      .single();

    if (error && error.code !== "PGRST116") {
      console.log("Erro Supabase:", error.message);
    }

    let contextoAtleta = "";

    if (atleta) {

      contextoAtleta = `
Atleta: ${atleta.nome}
Idade: ${atleta.idade}
Objetivo: ${atleta.objetivo}
Fadiga atual: ${atleta.fatigue}/10
`;

    } else {

      contextoAtleta = `
Usuário novo.

Peça as seguintes informações antes de montar o treino:

Nome
Idade
Objetivo
Nível de condicionamento
`;

    }

    /* ================================
       CHAMAR IA GROQ
    ================================ */

    const completion = await groq.chat.completions.create({

      messages: [

        {
          role: "system",
          content: NUCLEO_8_PROMPT + "\n" + contextoAtleta
        },

        {
          role: "user",
          content: messageText
        }

      ],

      model: "llama3-70b-8192",
      temperature: 0.7

    });

    const respostaIA = completion.choices[0].message.content;

    console.log("Resposta IA:", respostaIA);

    /* ================================
       ENVIAR MENSAGEM VIA EVOLUTION
    ================================ */

    await axios.post(

      `${EVO_URL}/message/sendText/${EVO_INSTANCE}`,

      {
        number: phone,
        text: respostaIA
      },

      {
        headers: {
          apikey: EVO_KEY
        }
      }

    );

    /* ================================
       ATUALIZAR ÚLTIMO TREINO
    ================================ */

    if (
      messageText.toLowerCase().includes("treino") &&
      atleta
    ) {

      await supabase
        .from('Atletas')
        .update({ last_workout: new Date() })
        .eq('id', atleta.id);

    }

    res.status(200).json({ status: "ok" });

  } catch (err) {

    console.log("Erro Webhook:", err);

    res.sendStatus(500);

  }

});

/* ================================
   INICIAR SERVIDOR
================================ */

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {

  console.log(`Servidor NÚCLEO 8 rodando na porta ${PORT}`);

});
