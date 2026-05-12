

# FECAP - Fundação de Comércio Álvares Penteado

<p align="center">
<a href= "https://www.fecap.br/"><img src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRhZPrRa89Kma0ZZogxm0pi-tCn_TLKeHGVxywp-LXAFGR3B1DPouAJYHgKZGV0XTEf4AE&usqp=CAU" alt="FECAP - Fundação de Comércio Álvares Penteado" border="0"></a>
</p>

# EmpathTech

## Grupo 7 - EmpathTech

## Integrantes: <a href= "https://github.com/carlinhoslatorre"> Carlos Roberto Santos Latorre</a>, <a href = "https://www.linkedin.com/in/felipeosantosojo/ "> Felipe Oluwaseun Santos Ojo</a>,<a href= "https://www.linkedin.com/in/felipe-wakasa-76a93a257/"> Felipe Wakasa Klabunde</a>, <a href= "https://www.linkedin.com/in/stephany-aliyah-4a2589321/"> Stephany Aliyah Guimarães Eurípedes de Paula</a>


## Professores Orientadores: <a href="https://www.linkedin.com/in/marcos-minoru-nakatsugawa/">Marcos Minoru Nakatsugawa</a>,<a href="https://www.linkedin.com/in/rafael-diogo-rossetti/">Rafael Diogo Rossetti</a>, <a href="https://www.linkedin.com/in/rodrigo-da-rosa-phd/">Rodrigo da Rosa</a>, <a href="https://www.linkedin.com/in/professorrodnil/">Rodnil da Silva Moreira Lisbôa</a>, <a href="https://www.linkedin.com/in/victorbarq/">Victor Bruno Alexander Rosetti de Quiroz</a>
## Descrição

<p align="center">
  <img src="imagens/EmpathTech(Logo).png" alt="Logo EmpathTech" width="450">
</p>

<p align="center">
  Project by Carlos Roberto, Felipe Oluwaseun, Felipe Wakasa e Stephany Aliyah.
</p>

O **EmpathTech** foi desenvolvido para apoiar campanhas de arrecadação de alimentos, principalmente na etapa de contagem e organização dos itens recebidos. Em muitas ações sociais, esse controle ainda é feito manualmente, o que pode causar atrasos, erros na triagem e dificuldade para acompanhar com precisão a quantidade de alimentos arrecadados. A proposta do projeto é facilitar esse processo, oferecendo uma forma mais ágil e confiável de registrar as doações.

Para isso, o sistema utiliza **Inteligência Artificial** e **Visão Computacional** para identificar os alimentos a partir de imagens e registrar as informações de maneira automatizada. A solução também integra banco de dados e computação em nuvem, permitindo que os dados sejam armazenados e consultados com mais organização. Dessa forma, o EmpathTech busca contribuir com o trabalho das instituições e voluntários, ajudando na gestão das doações e permitindo que mais tempo seja dedicado à distribuição dos alimentos para quem precisa.
<br><br>

## 🛠 Estrutura de pastas

```text
Raiz
|
|--> documentos
|   |
|   |--> Entrega 1
|   |   |--> Inteligência Artificial e Aprendizado de Máquina
|   |   |--> Projeto Interdisciplinar - Inteligência Artificial
|   |   |--> Psicologia, Liderança e Soft Skills
|   |   |--> Sistemas Operacionais e Computação em Nuvem
|   |   |--> Álgebra Linear, Vetores e Geometria Analítica
|   |
|   |--> Entrega 2
|       |--> Inteligência Artificial e Aprendizado de Máquina
|       |--> Projeto Interdisciplinar - Inteligência Artificial
|       |--> Psicologia, Liderança e Soft Skills
|       |--> Sistemas Operacionais e Computação em Nuvem
|       |--> Álgebra Linear, Vetores e Geometria Analítica
|   
|   
|
|--> imagens
|
|--> src
|   |--> Backend
|   |--> Frontend
|
|--> README.md
```

📄 **README.md**: Arquivo que serve como guia e explicação geral sobre o projeto.

Há também 3 pastas principais que seguem da seguinte forma:

🗂️ **documentos**: Toda a documentação geral do projeto, incluindo as entregas das disciplinas do semestre.

📷 **imagens**: Imagens utilizadas para documentação, apresentação e explicação do projeto.

🌐 **src**: Pasta que contém o código-fonte da aplicação, separado entre frontend e backend.



## 🛠 Instalação

### Como rodar (passo a passo)

**Pré-requisitos**
- Node.js (16+), `npm` ou `bun` instalado
- Python 3.8+ e `pip` (para o ai-service)
- Opcional: Docker, se preferir conteinerizar os serviços

Siga estas instruções mínimas para executar localmente cada parte do projeto.

**Backend (Node.js)**

1. Entre na pasta: `src/Entrega 2/Backend`
2. Instale dependências:

```bash
cd "src/Entrega 2/Backend"
npm install
```

3. Configure variáveis de ambiente e inicie:

```bash

npm start   
node main.js
```

Observações: ajuste `PORT` e conexões de banco no arquivo `.env`.

**Frontend (React / Vite)**

1. Entre na pasta: `src/Entrega 2/Frontend`
2. Instale dependências e rode em modo de desenvolvimento:

```bash
cd "src/Entrega 2/Frontend"
npm install
npm run dev   
```

Se for necessário apontar a API do backend, defina `VITE_API_URL`.

**AI service (Python)**

1. Entre na pasta: `src/Frontend/ai-service`
2. Crie e ative um ambiente virtual (Windows):

```powershell
cd "src/Frontend/ai-service"
python -m venv .venv
.\.venv\Scripts\activate
```

Linux / macOS:

```bash
python -m venv .venv
source .venv/bin/activate
```

3. Instale dependências com `requirements.txt` e execute:

```bash
pip install -r requirements.txt  
python main.py                   
python -m api.server
```



## 📋 Licença/License

<p xmlns:cc="http://creativecommons.org/ns#" xmlns:dct="http://purl.org/dc/terms/">

  <a property="dct:title" rel="cc:attributionURL" href="https://github.com/2026-1-NCC5/Projeto7">
    EmpathTech
  </a>
  by
  <a href="https://github.com/2026-1-NCC5/Projeto7" rel="cc:attributionURL dct:creator" property="cc:attributionName">
    Carlos Roberto Santos Latorre
  </a>,
  <a href="https://github.com/2026-1-NCC5/Projeto7" rel="cc:attributionURL dct:creator" property="cc:attributionName">
    Felipe Oluwaseun Santos Ojo
  </a>,
  <a href="https://github.com/2026-1-NCC5/Projeto7" rel="cc:attributionURL dct:creator" property="cc:attributionName">
    Felipe Wakasa Klabunde
  </a>,
  <a href="https://github.com/2026-1-NCC5/Projeto7" rel="cc:attributionURL dct:creator" property="cc:attributionName">
    Stephany Aliyah Guimarães Eurípedes de Paula
  </a> is licensed under
  <a href="https://creativecommons.org/licenses/by/4.0/?ref=chooser-v1"
     target="_blank" rel="license noopener noreferrer" style="display:inline-block;">
     CC BY 4.0
    <img style="height:22px!important;margin-left:3px;vertical-align:text-bottom;"
         src="https://mirrors.creativecommons.org/presskit/icons/cc.svg?ref=chooser-v1" alt="">
    <img style="height:22px!important;margin-left:3px;vertical-align:text-bottom;"
         src="https://mirrors.creativecommons.org/presskit/icons/by.svg?ref=chooser-v1" alt="">
  </a>

</p>

## 🎓 Referências

1. Python: <https://www.python.org/>

2. React: <https://react.dev/>

3. Node.js: <https://nodejs.org/>

4. Label Studio: <https://labelstud.io/>

5. YOLO: <https://docs.ultralytics.com/>

6. PostgreSQL: <https://www.postgresql.org/>

7. AWS RDS: <https://aws.amazon.com/pt/rds/>
