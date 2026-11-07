// ==========================================
// GERADOR DE PDF (LAYOUT IDÊNTICO AO PLANILHAS.JS)
// ==========================================
async function gerarFichaPDF() {
    let dados = {};

    if (typeof livroCIPSelecionado !== 'undefined' && livroCIPSelecionado && document.getElementById('modalCIP') && document.getElementById('modalCIP').classList.contains('active')) {
        dados = { ...livroCIPSelecionado };
    } else {
        const getValue = (id) => {
            const el = document.getElementById(id);
            return el ? el.value.trim() : "";
        };

        dados = {
            capa_url: getValue('capa_url'),
            numero_tombo: getValue('numero_tombo'),
            data_reg: getValue('data_reg') || new Date().toLocaleDateString('pt-BR'),
            catalogador: getValue('catalogador'),
            tipo_material: getValue('tipo_material') || 'Livros',
            isbn: getValue('isbn'),
            issn: getValue('issn'),
            codigo_idioma: getValue('codigo_idioma') || 'po',
            classificacao_cdd: getValue('classificacao_cdd'),
            codigo_autor_cutter: getValue('codigo_autor_cutter'),
            codigo_livro: getValue('codigo_livro'),
            nome_pessoal: getValue('nome_pessoal'),
            autor_entidade: getValue('autor_entidade'),
            titulo_principal: getValue('titulo_principal'),
            subtitulo: getValue('subtitulo'),
            responsabilidade: getValue('responsabilidade'),
            edicao: getValue('edicao'),
            local_publicacao: getValue('local_publicacao'),
            editora: getValue('editora'),
            data_publicacao: getValue('data_publicacao'),
            descricao_fisica: getValue('descricao_fisica'),
            numero_paginas: getValue('numero_paginas'),
            detalhes_fisicos: getValue('detalhes_fisicos'),
            dimensoes: getValue('dimensoes'),
            indicacao_serie: getValue('indicacao_serie'),
            notas_gerais: getValue('notas_gerais'),
            nota_tese: getValue('nota_tese'),
            notas_resumo: getValue('notas_resumo'),
            assunto: getValue('assunto'),
            exemplares: getValue('exemplares') || '1',
            data_aquisicao: getValue('data_aquisicao'),
            tipo_aquisicao: getValue('tipo_aquisicao')
        };
    }

    if (!dados.titulo_principal) {
        alert('Por favor, informe ao menos o Título Principal antes de gerar o PDF.');
        return;
    }

    const { jsPDF } = window.jspdf || window.web_jspdf;
    const doc = new jsPDF('p', 'mm', 'a4');

    function drawField(doc, label, value, x, y, maxWidth = null) {
        if (!value) return 0;
        const lineHeight = 6;
        doc.setFontSize(10);
        if (!maxWidth) maxWidth = 200 - x;

        doc.setFont("helvetica", "bold");
        const labelWidth = doc.getTextWidth(label);
        doc.text(label, x, y);

        doc.setFont("helvetica", "normal");
        const firstLineWidth = maxWidth - labelWidth;
        const words = value.toString().split(' ');

        let firstLine = '';
        let remainingText = '';

        for (let i = 0; i < words.length; i++) {
            const testLine = firstLine + words[i] + ' ';
            if (doc.getTextWidth(testLine) <= firstLineWidth) {
                firstLine = testLine;
            } else {
                remainingText = words.slice(i).join(' ');
                break;
            }
        }

        doc.text(firstLine.trim(), x + labelWidth, y);
        let lines = 1;

        if (remainingText) {
            const otherLines = doc.splitTextToSize(remainingText, maxWidth);
            otherLines.forEach((line, index) => {
                doc.text(line, x, y + ((index + 1) * lineHeight));
            });
            lines += otherLines.length;
        }
        return lines;
    }

    function drawIfExists(doc, label, value, x, y, maxWidth) {
        if (!value || String(value).trim() === "") return 0;
        return drawField(doc, label, value, x, y, maxWidth);
    }

    let descFisica = dados.descricao_fisica || '';
    if (!descFisica) {
        const pag = dados.numero_paginas ? `${dados.numero_paginas} p.` : '';
        const det = dados.detalhes_fisicos ? ` : ${dados.detalhes_fisicos}` : '';
        const dim = dados.dimensoes ? ` ; ${dados.dimensoes}` : '';
        descFisica = `${pag}${det}${dim}`.trim();
    }

    const fileInput = document.getElementById('capa_file') || document.getElementById('imageInput');
    if (fileInput && fileInput.files && fileInput.files[0]) {
        try {
            const getBase64 = (file) => new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.readAsDataURL(file);
                reader.onload = () => resolve(reader.result);
                reader.onerror = error => reject(error);
            });
            const imgBackground = await getBase64(fileInput.files[0]);
            doc.addImage(imgBackground, imgBackground.startsWith('data:image/png') ? 'PNG' : 'JPEG', 0, 0, 210, 297);
        } catch (e) {
            console.warn("Não foi possível carregar a imagem de fundo", e);
        }
    }

    let y = 70;
    let lineSpacing = 6;
    let h = 0;

    h = Math.max(
        drawIfExists(doc, "Data: ", dados.data_reg, 10, y, 58),
        drawIfExists(doc, "Catalogador: ", dados.catalogador, 62, y, 72),
        drawIfExists(doc, "Tipo de Material: ", dados.tipo_material, 128, y, 72)
    );
    if (h > 0) y += (h * lineSpacing) + 2;

    h = Math.max(
        drawIfExists(doc, "(020) ISBN: ", dados.isbn, 10, y, 95),
        drawIfExists(doc, "ISSN: ", dados.issn, 105, y, 95)
    );
    if (h > 0) y += (h * lineSpacing) + 2;

    let hLang = drawIfExists(doc, "(041) Código do Idioma: ", dados.codigo_idioma, 10, y, 185);
    if (hLang > 0) y += 8;

    const classif = dados.classificacao_cdd || '';
    h = Math.max(
        drawIfExists(doc, "(090) Classificação: ", classif, 10, y, 68),
        drawIfExists(doc, "Código do Autor: ", dados.codigo_autor_cutter, 72, y, 68),
        drawIfExists(doc, "Edição/Volume: ", dados.edicao, 136, y, 62)
    );
    if (h > 0) y += (h * lineSpacing) + 2;

    const bloco1 = [
        ["(100) Nome Pessoal: ", dados.nome_pessoal],
        ["(110) Autor Entidade: ", dados.autor_entidade],
        ["(245) Título Principal: ", dados.titulo_principal],
        ["Subtítulo: ", dados.subtitulo],
        ["Indicação de Responsabilidade: ", dados.responsabilidade]
    ];

    bloco1.forEach(([label, value]) => {
        if (value) {
            const lines = drawField(doc, label, value, 10, y, 185);
            y += (lines * lineSpacing) + 1;
        }
    });

    h = Math.max(
        drawIfExists(doc, "(250) Indicação da edição: ", dados.edicao, 10, y, 95),
        drawIfExists(doc, "(260) Local de publicação: ", dados.local_publicacao, 105, y, 95)
    );
    if (h > 0) y += (h * lineSpacing) + 2;

    h = Math.max(
        drawIfExists(doc, "Nome do Editor: ", dados.editora, 10, y, 95),
        drawIfExists(doc, "Data de Publicação: ", dados.data_publicacao, 105, y, 95)
    );
    if (h > 0) y += (h * lineSpacing) + 2;

    const bloco2 = [
        ["(300) Descrição Física: ", descFisica],
        ["(490) Indicação da Série: ", dados.indicacao_serie],
        ["(500) Notas Gerais: ", dados.notas_gerais],
        ["(502) Notas de dissertação ou tese: ", dados.nota_tese],
        ["(520) Notas de Resumo: ", dados.notas_resumo],
        ["(650) Assunto: ", dados.assunto],
        ["Nº de Exemplares: ", dados.exemplares]
    ];

    bloco2.forEach(([label, value]) => {
        if (value) {
            const lines = drawField(doc, label, value, 10, y, 185);
            y += (lines * lineSpacing) + 1;
        }
    });

    h = Math.max(
        drawIfExists(doc, "Data de Aquisição: ", dados.data_aquisicao, 10, y, 95),
        drawIfExists(doc, "Tipo de Aquisição: ", dados.tipo_aquisicao, 105, y, 95)
    );
    if (h > 0) y += (h * lineSpacing) + 2;

    const footerX = 10;
    const footerY = 245;
    const molduraLargura = 100;
    const molduraAltura = 45;

    doc.setDrawColor(0);
    doc.setLineWidth(0.2);
    doc.rect(footerX, footerY, molduraLargura, molduraAltura);

    doc.setFont("times", "normal");
    doc.setFontSize(7);
    doc.text(
        "Dados Internacionais de Catalogação na Publicação (CIP)",
        footerX + (molduraLargura / 2),
        footerY + 5,
        { align: "center" }
    );

    doc.setFontSize(8);
    doc.text(
        dados.codigo_autor_cutter || "",
        footerX + 3,
        footerY + 12
    );

    const autorCIP = dados.nome_pessoal || dados.autor_entidade || "";
    const responsabilidadeCIP = dados.responsabilidade || autorCIP || "";
    const tituloCompleto = `${dados.titulo_principal || ""}${dados.subtitulo ? ": " + dados.subtitulo : ""}`;
    const dadosPublicacao = `${dados.local_publicacao || ""} : ${dados.editora || ""}, ${dados.data_publicacao || ""}.`;
    const isbnStr = dados.isbn ? `ISBN ${dados.isbn}` : (dados.issn ? `ISSN ${dados.issn}` : "");
    const serieStr = dados.indicacao_serie ? `(${dados.indicacao_serie})` : "";
    const assuntoPrincipal = dados.assunto || "";

    const linha1 = `${autorCIP}.`;
    const linha2Texto = `${tituloCompleto} / ${responsabilidadeCIP}. — ${dadosPublicacao}`;
    const linha3 = `${descFisica}${serieStr ? " " + serieStr : ""}`;
    const linha4texto = `1. ${assuntoPrincipal}. I. Título.`;

    const larguraTexto = 72;

    const linha1Split = doc.splitTextToSize(linha1, larguraTexto);
    const primeiraLinhaComRecuo = "    " + linha2Texto;
    const linha2Split = doc.splitTextToSize(primeiraLinhaComRecuo, larguraTexto);
    const linha3Split = doc.splitTextToSize(linha3, larguraTexto);
    const quartaLinhaComRecuo = "    " + linha4texto;
    const linha4Split = doc.splitTextToSize(quartaLinhaComRecuo, larguraTexto);
    const linha5Split = isbnStr ? doc.splitTextToSize(isbnStr, larguraTexto) : [];

    doc.setFont("times", "normal");
    doc.text(linha1Split, footerX + 16, footerY + 12);

    let yTexto = footerY + 15;
    doc.text(linha2Split, footerX + 16, yTexto);

    yTexto += (linha2Split.length * 3.5);
    doc.text(linha3Split, footerX + 20, yTexto);

    if (isbnStr) {
        yTexto += (linha3Split.length * 3.5);
        doc.text(linha5Split, footerX + 20, yTexto);
    }

    doc.text(linha4Split, footerX + 16, footerY + 38);

    doc.setFont("times", "normal");
    doc.setFontSize(8);
    doc.text(
        "CDD " + classif,
        footerX + 97,
        footerY + 42,
        { align: "right" }
    );

    const refX = 120;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("REFERÊNCIA (ABNT):", refX, footerY + 4);
    doc.setFont("helvetica", "normal");

    const refText = gerarReferenciaABNT(dados);
    const splitRef = doc.splitTextToSize(refText, 80);
    doc.text(splitRef, refX, footerY + 10);

    let nomeArquivo = `${dados.codigo_autor_cutter || "sem_codigo"} - ${dados.titulo_principal || "sem_titulo"}`;
    nomeArquivo = nomeArquivo.replace(/[\\/:*?"<>|]/g, "").replace(/\s+/g, " ").trim();

    doc.save(nomeArquivo + ".pdf");
}

async function salvarRegistroAcervo(event, isAtualizacao = false) {
    if (event) event.preventDefault();

    const getValue = (id) => {
        const el = document.getElementById(id);
        const val = el ? el.value.trim() : "";
        return val === "" ? null : val;
    };

    const getIntOrNull = (id) => {
        const el = document.getElementById(id);
        if (!el || el.value.trim() === "") return null;
        const parsed = parseInt(el.value.trim(), 10);
        return isNaN(parsed) ? null : parsed;
    };

    const idExistente = isAtualizacao ? getValue('livro_id') : null;
    const tituloPrincipal = getValue('titulo_principal') || getValue('tituloPrincipal') || getValue('txtTitulo');
    
    if (!tituloPrincipal) {
        alert('Por favor, preencha ao menos o campo "Título Principal".');
        const elTitulo = document.getElementById('titulo_principal');
        if (elTitulo) elTitulo.focus();
        return;
    }

    let tomboFinal = getValue('numero_tombo');
    if (!tomboFinal) {
        const anoAtual = new Date().getFullYear();
        const seqs = (acervoCompleto || []).map(l => parseInt(String(l.numero_tombo || '').split(';')[0], 10) || 0);
        const count = Math.max(0, ...seqs) + 1;
        tomboFinal = `${String(count).padStart(7, '0')}; ${anoAtual}.${count}`;
    }

    const novoRegistro = {
        capa_url: getValue('capa_url'),
        numero_tombo: tomboFinal,
        data_reg: getValue('data_reg') || new Date().toISOString().split('T')[0],
        catalogador: getValue('catalogador'),
        tipo_material: getValue('tipo_material') || 'Livros',
        isbn: getValue('isbn'),
        issn: getValue('issn'),
        fonte_catalogacao: getValue('fonte_catalogacao'),
        codigo_idioma: getValue('codigo_idioma') || 'po',
        classificacao_cdd: getValue('classificacao_cdd'),
        codigo_autor_cutter: getValue('codigo_autor_cutter'),
        codigo_livro: getValue('codigo_livro') || getValue('numero_chamada_local'),
        numero_chamada_local: getValue('numero_chamada_local') || getValue('codigo_livro'),
        nome_pessoal: getValue('nome_pessoal'),
        autor_entidade: getValue('autor_entidade'),
        titulo_principal: tituloPrincipal,
        subtitulo: getValue('subtitulo'),
        responsabilidade: getValue('responsabilidade'),
        edicao: getValue('edicao'),
        local_publicacao: getValue('local_publicacao'),
        editora: getValue('editora'),
        data_publicacao: getValue('data_publicacao'),
        descricao_fisica: getValue('descricao_fisica'),
        numero_paginas: getIntOrNull('numero_paginas'),
        detalhes_fisicos: getValue('detalhes_fisicos'),
        dimensoes: getValue('dimensoes'),
        indicacao_serie: getValue('indicacao_serie'),
        notas_gerais: getValue('notas_gerais'),
        nota_bibliografia: getValue('nota_bibliografia'),
        nota_conteudo: getValue('nota_conteudo'),
        nota_tese: getValue('nota_tese'),
        notas_resumo: getValue('notas_resumo'),
        assunto: getValue('assunto'),
        iniciais_assunto: getValue('iniciais_assunto'),
        classificacao_geral: getValue('classificacao_geral') || 'Geral',
        entrada_secundaria_pessoal: getValue('entrada_secundaria_pessoal'),
        entrada_secundaria_entidade: getValue('entrada_secundaria_entidade'),
        link_eletronico: getValue('link_eletronico'),
        exemplares: getIntOrNull('exemplares') || 1,
        data_aquisicao: getValue('data_aquisicao'),
        tipo_aquisicao: getValue('tipo_aquisicao'),
        preco: getValue('preco'),
        condicao_capa: getValue('condicao_capa') || 'Bom',
        em_lixeira: false,
        updated_at: new Date().toISOString()
    };

    if (idExistente) {
        novoRegistro.id = Number(idExistente);
    }

    if (!supabaseClient) { alert('Sem conexão com o banco de dados. Registro não salvo.'); return; }
    try {
        const tabela = supabaseClient.from('acervo');
        const { error } = idExistente ? await tabela.update(novoRegistro).eq('id', idExistente) : await tabela.insert([novoRegistro]);
        if (error) throw error;
        alert(idExistente ? 'Registro atualizado com sucesso!' : 'Registro salvo no acervo com sucesso!');
        limparFormulario();
        await carregarAcervo();
    } catch (err) {
        console.error('Erro ao salvar no Supabase:', err);
        alert('Erro do Banco de Dados: ' + err.message);
    }
}

function carregarCapaJPEG(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (file.type !== 'image/jpeg' && file.type !== 'image/jpg') {
        alert('Por favor, selecione uma imagem no formato JPEG (.jpg ou .jpeg).');
        event.target.value = '';
        return;
    }

    const reader = new FileReader();
    reader.onload = function (e) {
        const img = new Image();
        img.src = e.target.result;

        img.onload = function () {
            const canvas = document.createElement('canvas');
            const maxDimension = 500;
            let width = img.width;
            let height = img.height;

            if (width > height) {
                if (width > maxDimension) {
                    height = Math.round((height *= maxDimension / width));
                    width = maxDimension;
                }
            } else {
                if (height > maxDimension) {
                    width = Math.round((width *= maxDimension / height));
                    height = maxDimension;
                }
            }

            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);

            const compressedBase64 = canvas.toDataURL('image/jpeg', 0.75);
            document.getElementById('capa_url').value = compressedBase64;

            const previewImg = document.getElementById('imgPreviewCapa');
            const previewContainer = document.getElementById('previewCapaContainer');
            if (previewImg && previewContainer) {
                previewImg.src = compressedBase64;
                previewContainer.style.display = 'flex';
            }
        };
    };
    reader.readAsDataURL(file);
}

function removerCapaJPEG() {
    document.getElementById('capa_url').value = '';
    const fileInput = document.getElementById('capa_file');
    if (fileInput) fileInput.value = '';
    const previewContainer = document.getElementById('previewCapaContainer');
    if (previewContainer) previewContainer.style.display = 'none';
}

function formatarDataMascara(input) {
    let v = input.value.replace(/\D/g, "");
    if (v.length > 8) v = v.substring(0, 8);

    if (v.length > 4) {
        input.value = v.substring(0, 2) + "/" + v.substring(2, 4) + "/" + v.substring(4);
    } else if (v.length > 2) {
        input.value = v.substring(0, 2) + "/" + v.substring(2);
    } else {
        input.value = v;
    }
}

function gerarCodigoLivroMascara() {
    const cdd = document.getElementById('classificacao_cdd')?.value.trim() || '';
    const cutter = document.getElementById('codigo_autor_cutter')?.value.trim() || '';
    const ano = document.getElementById('data_publicacao')?.value.trim() || '';

    const partes = [cdd, cutter, ano].filter(Boolean);
    const numeroChamada = partes.join(' ');

    const inputChamada = document.getElementById('codigo_livro') || document.getElementById('numero_chamada_local');
    if (inputChamada) {
        inputChamada.value = numeroChamada;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const camposParaMonitorar = [
        'classificacao_cdd',
        'codigo_autor_cutter',
        'data_publicacao'
    ];

    camposParaMonitorar.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', gerarCodigoLivroMascara);
        }
    });

    const formAcervo = document.getElementById('formMARC') || document.getElementById('formCadastroAcervo');
    if (formAcervo && !formAcervo.dataset.listenerAttached) {
        formAcervo.dataset.listenerAttached = "true";
        formAcervo.addEventListener('submit', (e) => salvarRegistroAcervo(e, !!document.getElementById('livro_id')?.value));
    }
});

function alternarCamposPorTipoMaterial() {
    const tipoElem = document.getElementById('tipo_material');
    if (!tipoElem) return;
    const tipo = tipoElem.value;

    const grpIsbn = document.getElementById('grp_isbn');
    const grpIssn = document.getElementById('grp_issn');
    const grpEdicao = document.getElementById('grp_edicao');
    const grpIndicacaoSerie = document.getElementById('grp_indicacao_serie');
    const grpNotaBibliografia = document.getElementById('grp_nota_bibliografia');
    
    const grpPeriodicidade = document.getElementById('grp_periodicidade');
    const grpNumeracaoDatas = document.getElementById('grp_numeracao_datas');
    const grpEscalaMapa = document.getElementById('grp_escala_mapa');
    const grpNotaTese = document.getElementById('grp_nota_tese');
    const grpNotaSistema = document.getElementById('grp_nota_sistema');

    const exibe = (el) => { if (el) el.style.display = 'flex'; };
    const oculta = (el) => { if (el) el.style.display = 'none'; };

    exibe(grpIsbn);
    oculta(grpIssn);
    exibe(grpEdicao);
    exibe(grpIndicacaoSerie);
    exibe(grpNotaBibliografia);

    oculta(grpPeriodicidade);
    oculta(grpNumeracaoDatas);
    oculta(grpEscalaMapa);
    oculta(grpNotaTese);
    oculta(grpNotaSistema);

    switch (tipo) {
        case 'Livros':
            break;
        case 'Periodicos':
            oculta(grpIsbn);
            exibe(grpIssn);
            exibe(grpPeriodicidade);
            exibe(grpNumeracaoDatas);
            oculta(grpEdicao);
            break;
        case 'Tese':
            exibe(grpIsbn);
            exibe(grpNotaTese);
            oculta(grpIndicacaoSerie);
            break;
        case 'Cd/DVD':
            oculta(grpIssn);
            exibe(grpNotaSistema);
            oculta(grpIndicacaoSerie);
            break;
        case 'Foto':
            oculta(grpIsbn);
            oculta(grpIssn);
            oculta(grpEdicao);
            oculta(grpIndicacaoSerie);
            break;
        case 'Panfleto':
            exibe(grpIsbn);
            oculta(grpIndicacaoSerie);
            break;
        case 'Mapa':
            oculta(grpIsbn);
            oculta(grpIssn);
            exibe(grpEscalaMapa);
            oculta(grpEdicao);
            break;
        case 'Objeto 3D':
            oculta(grpIsbn);
            oculta(grpIssn);
            oculta(grpEdicao);
            oculta(grpIndicacaoSerie);
            oculta(grpNotaBibliografia);
            break;
        default:
            break;
    }
}

function atribuirProximoTombo() {
    const dataAtual = new Date();
    const anoAtual = dataAtual.getFullYear();
    let contadorAno = 1;

    if (typeof acervoCompleto !== 'undefined' && Array.isArray(acervoCompleto)) {
        const registrosAno = acervoCompleto.filter(l => {
            if (l.em_lixeira) return false;
            const dataReg = l.data_reg || '';
            return dataReg.includes(String(anoAtual));
        });
        contadorAno = registrosAno.length + 1;
    }

    const sequencialStr = String(contadorAno).padStart(7, '0');
    const estatisticaStr = `${anoAtual}.${contadorAno}`;
    const tomboDuploFormatado = `${sequencialStr}; ${estatisticaStr}`;

    const inputTombo = document.getElementById('numero_tombo');
    if (inputTombo) {
        inputTombo.value = tomboDuploFormatado;
    }
}

function gerarReferenciaABNT(dados) {
    const autor = (dados.nome_pessoal || dados.autor_entidade || '').trim();
    let autorFormatado = autor;

    if (dados.nome_pessoal && dados.nome_pessoal.includes(',')) {
        const partes = dados.nome_pessoal.split(',');
        const sobrenome = partes[0].trim().toUpperCase();
        const nome = partes.slice(1).join(',').trim();
        autorFormatado = `${sobrenome}, ${nome}`;
    } else if (dados.autor_entidade) {
        autorFormatado = dados.autor_entidade.toUpperCase();
    }

    const titulo = dados.titulo_principal || 'Sem título';
    const subtitulo = dados.subtitulo ? `: ${dados.subtitulo}` : '';
    const edicao = dados.edicao ? ` ${dados.edicao}.` : '';
    const local = dados.local_publicacao || 'S.l.';
    const editora = dados.editora || 's.n.';
    const ano = dados.data_publicacao || 's.d.';
    const paginas = dados.numero_paginas ? ` ${dados.numero_paginas}.` : '';

    switch (dados.tipo_material) {
        case 'Periodicos':
            const issnMencao = dados.issn ? ` ISSN ${dados.issn}.` : '';
            const perio = dados.periodicidade ? ` ${dados.periodicidade}.` : '';
            return `${autorFormatado ? autorFormatado + '. ' : ''}*${titulo}*${subtitulo}. ${local}: ${editora}, ${ano}.${perio}${issnMencao}`.replace(/\*/g, '');

        case 'Tese':
            const notaTese = dados.nota_tese ? ` ${dados.nota_tese}.` : '';
            return `${autorFormatado}. *${titulo}*${subtitulo}.${edicao} ${ano}.${notaTese}`;

        case 'Cd/DVD':
            const sistema = dados.nota_sistema ? ` ${dados.nota_sistema}.` : '';
            return `${autorFormatado}. *${titulo}*${subtitulo}. ${local}: ${editora}, ${ano}. ${paginas}${sistema}`;

        case 'Mapa':
            const escala = dados.escala_mapa ? ` ${dados.escala_mapa}.` : '';
            return `${autorFormatado}. *${titulo}*${subtitulo}. ${local}: ${editora}, ${ano}.${escala}`;

        default:
            return `${autorFormatado ? autorFormatado + '. ' : ''}*${titulo}*${subtitulo}.${edicao} ${local}: ${editora}, ${ano}.${paginas}`.replace(/\*/g, '');
    }
}

function verCIP(id) {
    if (typeof acervoCompleto === 'undefined' || !Array.isArray(acervoCompleto)) return;
    const livro = acervoCompleto.find(l => l.id == id);
    if (!livro) return;

    livroCIPSelecionado = livro;
    const area = document.getElementById('areaFichaCIP');
    if (!area) return;

    const autor = livro.nome_pessoal || livro.autor_entidade || 'Autor não informado';
    const titulo = livro.titulo_principal || 'Sem título';
    const subtitulo = livro.subtitulo ? `: ${escaparHTML(livro.subtitulo)}` : '';
    const imprenta = `${escaparHTML(livro.local_publicacao || 's.l.')} : ${escaparHTML(livro.editora || 's.n.')}, ${escaparHTML(livro.data_publicacao || 's.d.')}.`;
    const paginas = livro.numero_paginas ? `${escaparHTML(livro.numero_paginas)}` : '';
    const isbn = livro.isbn ? `ISBN ${escaparHTML(livro.isbn)}` : '';
    const assunto = livro.assunto ? `1. ${escaparHTML(livro.assunto)}.` : '';
    const cdd = livro.classificacao_cdd || '';
    const cutter = livro.codigo_autor_cutter || '';

    area.innerHTML = `
        <div style="text-align:center; font-weight:bold; margin-bottom:8px; font-size:0.8rem;">
            Dados Internacionais de Catalogação na Publicação (CIP)<br>Venous
        </div>
        <hr style="border: 0; border-top: 1px solid #000; margin: 6px 0;">
        <div style="margin-left: 20px; text-indent: -20px;">
            <strong>${escaparHTML(autor)}</strong><br>
            ${escaparHTML(titulo)}${escaparHTML(subtitulo)} / ${escaparHTML(livro.responsabilidade || autor)}. -- ${escaparHTML(livro.edicao || '1. ed.')} -- ${escaparHTML(imprenta)}<br>
            ${escaparHTML(paginas)}<br><br>
            ${escaparHTML(isbn)}<br><br>
            ${escaparHTML(assunto)} I. Título.<br>
            <div style="text-align:right;">Cutter: ${escaparHTML(cutter)}</div>
        </div>
        <hr style="border: 0; border-top: 1px solid #000; margin: 6px 0;">
    `;

    if (typeof exibirResenhasModal === 'function') exibirResenhasModal(id);
    const modalCIP = document.getElementById('modalCIP');
    if (modalCIP) modalCIP.classList.add('active');
}

function fecharModalCIP() {
    const modalCIP = document.getElementById('modalCIP');
    if (modalCIP) modalCIP.classList.remove('active');
}

async function moverParaLixeira(id) {
    if (typeof usuarioAtual === 'undefined' || usuarioAtual.cargo !== 'bibliotecario') {
        alert('Apenas bibliotecários podem mover itens para a lixeira.');
        return;
    }

    if (confirm('Deseja mover este registro para a lixeira?')) {
        if (typeof supabaseClient !== 'undefined' && supabaseClient) {
            await supabaseClient.from('acervo').update({ em_lixeira: true }).eq('id', id);
        }
        alert('Item movido para a lixeira.');
        if (typeof carregarAcervo === 'function') carregarAcervo();
    }
}

function renderizarLixeira() {
    const tbody = document.getElementById('tbLixeiraBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (typeof acervoCompleto === 'undefined' || !Array.isArray(acervoCompleto)) return;

    const lixeira = acervoCompleto.filter(l => l.em_lixeira);
    if (lixeira.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Nenhum livro na lixeira.</td></tr>';
        return;
    }

    lixeira.forEach(livro => {
        const capaSrc = livro.capa_url || '';
        const imgHtml = capaSrc ? `<img src="${escaparHTML(capaSrc)}" style="height:40px; border-radius:4px;">` : '-';
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${imgHtml}</td>
            <td><strong>${escaparHTML(livro.titulo_principal || 'Sem título')}</strong></td>
            <td>${escaparHTML(livro.nome_pessoal || livro.autor_entidade || '-')}</td>
            <td>${escaparHTML(livro.numero_tombo || '-')}</td>
            <td>${escaparHTML(livro.classificacao_cdd || '-')}</td>
            <td style="display:flex; gap:6px;">
                <button class="btn btn-primary" style="padding:2px 6px; font-size:0.75rem;" onclick="restaurarDaLixeira(${livro.id})">
                    <i class="fa-solid fa-rotate-left"></i> Restaurar
                </button>
                <button class="btn btn-danger" style="padding:2px 6px; font-size:0.75rem;" onclick="excluirDefinitivamenteDaLixeira(${livro.id})">
                    <i class="fa-solid fa-trash-can"></i> Excluir
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

async function restaurarDaLixeira(id) {
    if (typeof supabaseClient !== 'undefined' && supabaseClient) {
        await supabaseClient.from('acervo').update({ em_lixeira: false }).eq('id', id);
    }
    alert('Item restaurado com sucesso!');
    if (typeof carregarAcervo === 'function') carregarAcervo();
}

async function excluirDefinitivamenteDaLixeira(id) {
    if (typeof usuarioAtual === 'undefined' || usuarioAtual.cargo !== 'bibliotecario') {
        alert('Apenas bibliotecários podem excluir definitivamente itens da lixeira.');
        return;
    }

    if (confirm('ATENÇÃO: Esta ação é irreversível. Deseja realmente EXCLUIR DEFINITIVAMENTE este livro do sistema?')) {
        if (typeof supabaseClient !== 'undefined' && supabaseClient) {
            const { error } = await supabaseClient.from('acervo').delete().eq('id', id);
            if (error) {
                alert('Erro ao excluir item: ' + error.message);
                return;
            }
        }
        alert('Item excluído permanentemente!');
        if (typeof carregarAcervo === 'function') carregarAcervo();
    }
}

function editarLivro(id) {
    // Se o formulário não estiver na página atual, redireciona para catalogacao.html com o ID na URL
    const formCatalogacao = document.getElementById('formMARC') || document.getElementById('formCadastroAcervo');
    if (!formCatalogacao) {
        window.location.href = `catalogacao.html?editar=${id}`;
        return;
    }

    // Caso já esteja na página de catalogação, preenche o formulário diretamente
    const livro = acervoCompleto.find(item => Number(item.id) === Number(id));
    if (!livro) {
        alert("Registro não encontrado no acervo!");
        return;
    }

    document.getElementById('livro_id').value = livro.id || '';

    document.getElementById('capa_url').value = livro.capa_url || '';
    if (livro.capa_url) {
        const imgPrev = document.getElementById('imgPreviewCapa');
        const prevContainer = document.getElementById('previewCapaContainer');
        if (imgPrev) imgPrev.src = livro.capa_url;
        if (prevContainer) prevContainer.style.display = 'flex';
    } else {
        removerCapaJPEG();
    }

    // Preenchimento dos campos MARC21
    document.getElementById('numero_tombo').value = livro.numero_tombo || '';
    document.getElementById('data_reg').value = livro.data_reg || '';
    document.getElementById('catalogador').value = livro.catalogador || '';
    document.getElementById('tipo_material').value = livro.tipo_material || 'Livros';
    
    document.getElementById('isbn').value = livro.isbn || '';
    document.getElementById('issn').value = livro.issn || '';
    document.getElementById('fonte_catalogacao').value = livro.fonte_catalogacao || '';
    document.getElementById('codigo_idioma').value = livro.codigo_idioma || '';

    document.getElementById('classificacao_cdd').value = livro.classificacao_cdd || '';
    document.getElementById('codigo_autor_cutter').value = livro.codigo_autor_cutter || '';
    const inputChamada = document.getElementById('codigo_livro') || document.getElementById('numero_chamada_local');
    if (inputChamada) inputChamada.value = livro.codigo_livro || livro.numero_chamada_local || '';

    document.getElementById('nome_pessoal').value = livro.nome_pessoal || '';
    document.getElementById('autor_entidade').value = livro.autor_entidade || '';

    document.getElementById('titulo_principal').value = livro.titulo_principal || livro.tituloPrincipal || '';
    document.getElementById('subtitulo').value = livro.subtitulo || '';
    document.getElementById('responsabilidade').value = livro.responsabilidade || '';
    document.getElementById('edicao').value = livro.edicao || '';
    document.getElementById('local_publicacao').value = livro.local_publicacao || '';
    document.getElementById('editora').value = livro.editora || '';
    document.getElementById('data_publicacao').value = livro.data_publicacao || '';

    document.getElementById('numero_paginas').value = livro.numero_paginas || '';
    document.getElementById('detalhes_fisicos').value = livro.detalhes_fisicos || '';
    document.getElementById('dimensoes').value = livro.dimensoes || '';
    document.getElementById('descricao_fisica').value = livro.descricao_fisica || '';
    document.getElementById('indicacao_serie').value = livro.indicacao_serie || '';

    document.getElementById('notas_gerais').value = livro.notas_gerais || '';
    document.getElementById('nota_bibliografia').value = livro.nota_bibliografia || '';
    document.getElementById('nota_conteudo').value = livro.nota_conteudo || '';
    document.getElementById('notas_resumo').value = livro.notas_resumo || '';
    document.getElementById('nota_tese').value = livro.nota_tese || '';

    document.getElementById('assunto').value = livro.assunto || '';
    document.getElementById('iniciais_assunto').value = livro.iniciais_assunto || '';
    document.getElementById('classificacao_geral').value = livro.classificacao_geral || 'Geral';

    document.getElementById('entrada_secundaria_pessoal').value = livro.entrada_secundaria_pessoal || '';
    document.getElementById('entrada_secundaria_entidade').value = livro.entrada_secundaria_entidade || '';
    document.getElementById('link_eletronico').value = livro.link_eletronico || '';

    document.getElementById('exemplares').value = livro.exemplares || 1;
    document.getElementById('data_aquisicao').value = livro.data_aquisicao || '';
    document.getElementById('tipo_aquisicao').value = livro.tipo_aquisicao || '';
    document.getElementById('preco').value = livro.preco || '';
    document.getElementById('condicao_capa').value = livro.condicao_capa || 'Bom';

    if (typeof alternarCamposPorTipoMaterial === 'function') alternarCamposPorTipoMaterial();

    const btnAtualizar = document.getElementById('btnAtualizarRegistro');
    if (btnAtualizar) btnAtualizar.style.display = 'inline-block';

    if (typeof trocarAba === 'function') {
        trocarAba('catalogacao');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function limparFormulario() {
    const form = document.getElementById('formMARC');
    if (form) form.reset();

    const lvId = document.getElementById('livro_id');
    const cpUrl = document.getElementById('capa_url');
    if (lvId) lvId.value = '';
    if (cpUrl) cpUrl.value = '';

    const preview = document.getElementById('previewCapaContainer');
    if (preview) preview.style.display = 'none';

    const btnAtualizar = document.getElementById('btnAtualizarRegistro');
    if (btnAtualizar) btnAtualizar.style.display = 'none';

    alternarCamposPorTipoMaterial();
}

async function buscarDadosISBN() {
    const inputIsbn = document.getElementById('isbn');
    if (!inputIsbn) return;

    const isbnLimpo = inputIsbn.value.replace(/[^0-9X]/gi, '');
    if (!isbnLimpo || isbnLimpo.length < 10) return;

    try {
        inputIsbn.style.borderColor = '#f59e0b';
        const url = `https://openlibrary.org/api/books?bibkeys=ISBN:${isbnLimpo}&format=json&jscmd=data`;
        const response = await fetch(url);
        const data = await response.json();

        const bookKey = `ISBN:${isbnLimpo}`;
        if (data && data[bookKey]) {
            const livro = data[bookKey];

            if (livro.title) document.getElementById('titulo_principal').value = livro.title;
            if (livro.subtitle) document.getElementById('subtitulo').value = livro.subtitle;
            if (livro.authors && livro.authors.length > 0) {
                document.getElementById('nome_pessoal').value = livro.authors.map(a => a.name).join('; ');
            }
            if (livro.publishers && livro.publishers.length > 0) {
                document.getElementById('editora').value = livro.publishers.map(p => p.name).join(', ');
            }
            if (livro.publish_places && livro.publish_places.length > 0) {
                document.getElementById('local_publicacao').value = livro.publish_places.map(p => p.name).join(', ');
            }
            if (livro.publish_date) {
                const anoMatch = livro.publish_date.match(/\d{4}/);
                document.getElementById('data_publicacao').value = anoMatch ? anoMatch[0] : livro.publish_date;
            }
            if (livro.number_of_pages) {
                document.getElementById('numero_paginas').value = livro.number_of_pages;
                document.getElementById('descricao_fisica').value = `${livro.number_of_pages} p.`;
            }
            if (livro.cover && livro.cover.large) {
                const capaUrlInput = document.getElementById('capa_url');
                const imgPreview = document.getElementById('imgPreviewCapa');
                const containerPreview = document.getElementById('previewCapaContainer');
                
                if (capaUrlInput) capaUrlInput.value = livro.cover.large;
                if (imgPreview) imgPreview.src = livro.cover.large;
                if (containerPreview) containerPreview.style.display = 'flex';
            }

            inputIsbn.style.borderColor = '#10b981';
        } else {
            inputIsbn.style.borderColor = 'var(--border-color)';    
        }
    } catch (err) {
        console.warn('Erro ao carregar catalogação automática via ISBN:', err);
        inputIsbn.style.borderColor = 'var(--border-color)';
    }
}

function popularSelectEtiquetas() {
    const selMultiplo = document.getElementById('selectLivrosEtiquetasMultiplas');
    if (!selMultiplo) return;

    let optionsHtml = '';

    if (Array.isArray(acervoCompleto)) {
        const obrasAtivas = acervoCompleto.filter(l => !l.em_lixeira);

        if (obrasAtivas.length === 0) {
            optionsHtml = '<option value="">Nenhuma obra cadastrada no acervo...</option>';
        } else {
            obrasAtivas.forEach(l => {
                const titulo = l.titulo_principal || l.tituloPrincipal || 'Sem Título';
                const tombo = l.numero_tombo || 'Sem Tombo';
                const autor = l.nome_pessoal || l.autor_entidade || 'Autor Desconhecido';

                optionsHtml += `<option value="${l.id}">${escaparHTML(autor)} — "${escaparHTML(titulo)}" (Tombo: ${escaparHTML(tombo)})</option>`;
            });
        }
    }

    selMultiplo.innerHTML = optionsHtml;
    atualizarPreviewFolhaA4();
}

function atualizarPreviewFolhaA4() {
    const select = document.getElementById('selectLivrosEtiquetasMultiplas');
    const container = document.getElementById('previewEtiquetasContainer');
    if (!select || !container) return;

    const idsSelecionados = Array.from(select.selectedOptions).map(opt => Number(opt.value)).filter(Boolean);

    if (idsSelecionados.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; color: #94a3b8; font-size: 0.8rem; padding: 40px 0;">
                Nenhum livro selecionado acima.
            </div>
        `;
        return;
    }

    const livrosParaPreview = acervoCompleto.filter(l => idsSelecionados.includes(Number(l.id)));
    container.innerHTML = '';

    livrosParaPreview.forEach((livro) => {
        const autor = livro.nome_pessoal || livro.autor_entidade || 'Autor Desconhecido';
        const titulo = livro.titulo_principal || livro.tituloPrincipal || 'Sem Título';
        const tombo = livro.numero_tombo || '0000001';
        const cdd = livro.classificacao_cdd || '000';
        const cutter = livro.codigo_autor_cutter || '';
        const edicao = livro.edicao || '1. ed.';
        
        const codigoBarrasReal = livro.isbn ? livro.isbn : tombo.replace(/[^0-9]/g, '').padEnd(13, '0').substring(0, 13);

        container.innerHTML += `
            <div style="background: #ffffff; color: #111827; border: 1.5px solid #0f172a; border-radius: 4px; padding: 10px; display: flex; justify-content: space-between; align-items: center; position: relative; overflow: hidden; height: 75px;">
                <div style="position: absolute; top: 0; left: 0; width: 3px; height: 100%; background: #0284c7;"></div>
                
                <div style="display: flex; flex-direction: column; justify-content: center; gap: 2px; padding-left: 6px; max-width: 68%;">
                    <div style="font-size: 0.65rem; font-weight: bold; line-height: 1.15; color: #0f172a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                        ${escaparHTML(autor)} — "${escaparHTML(titulo)}"
                    </div>
                    <div style="font-family: monospace; font-size: 0.85rem; font-weight: bold; letter-spacing: 1px; color: #1e293b;">
                        |||*${escaparHTML(codigoBarrasReal)}*|||
                    </div>
                    <div style="font-size: 0.65rem; font-weight: bold; color: #475569;">
                        Tombo: ${escaparHTML(tombo)}
                    </div>
                </div>

                <div style="display: flex; flex-direction: column; align-items: flex-end; text-align: right; font-size: 0.85rem; font-weight: bold; line-height: 1.2; padding-right: 2px;">
                    <span style="color: #0284c7;">${escaparHTML(cdd)}</span>
                    <span>${escaparHTML(cutter)}</span>
                    <span style="font-size: 0.65rem; color: #64748b; font-weight: normal;">${escaparHTML(edicao)}</span>
                </div>
            </div>
        `;
    });
}

function gerarFolhaA4Etiquetas() {
    const select = document.getElementById('selectLivrosEtiquetasMultiplas');
    if (!select) return;

    const idsSelecionados = Array.from(select.selectedOptions).map(opt => Number(opt.value)).filter(Boolean);

    if (idsSelecionados.length === 0) {
        alert('Por favor, selecione ao menos uma obra na lista para gerar a folha A4.');
        return;
    }

    const livrosParaImprimir = acervoCompleto.filter(l => idsSelecionados.includes(Number(l.id)));
    const janelaImpressao = window.open('', '_blank', 'width=850,height=900');
    if (!janelaImpressao) { alert('Permita pop-ups para imprimir as etiquetas.'); return; }

    let htmlEtiquetas = '';
    livrosParaImprimir.forEach((livro) => {
        const autor = livro.nome_pessoal || livro.autor_entidade || 'Autor Desconhecido';
        const titulo = livro.titulo_principal || livro.tituloPrincipal || 'Sem Título';
        const tombo = livro.numero_tombo || '0000001';
        const cdd = livro.classificacao_cdd || '';
        const cutter = livro.codigo_autor_cutter || '';
        const edicao = livro.edicao || '';

        const codigoBarrasReal = livro.isbn ? livro.isbn : tombo.replace(/[^0-9]/g, '').padEnd(13, '0').substring(0, 13);

        htmlEtiquetas += `
            <div class="etiqueta-bloco">
                <div class="etiqueta-esq">
                    <div class="autor-titulo">${escaparHTML(autor)}<br>"${escaparHTML(titulo)}"</div>
                    <div class="codigo-barras-real">|||*${escaparHTML(codigoBarrasReal)}*|||</div>
                    <div class="tombo-txt">Tombo: ${escaparHTML(tombo)}</div>
                </div>
                <div class="etiqueta-dir">
                    <div class="cdd-txt">${escaparHTML(cdd)}</div>
                    <div class="cutter-txt">${escaparHTML(cutter)}</div>
                    <div class="edicao-txt">${escaparHTML(edicao)}</div>
                </div>
            </div>
        `;
    });

    janelaImpressao.document.write(`
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
            <meta charset="UTF-8">
            <title>Impressão de Etiquetas A4 - Venous</title>
            <style>
                @page { size: A4; margin: 10mm; }
                body { font-family: 'Courier New', Courier, monospace; background: #fff; color: #000; margin: 0; padding: 0; }
                .folha-a4 { width: 190mm; display: flex; flex-direction: column; gap: 6mm; }
                .etiqueta-bloco { width: 100%; height: 48mm; border: 1px dashed #94a3b8; padding: 5mm 8mm; display: flex; justify-content: space-between; align-items: center; box-sizing: border-box; page-break-inside: avoid; background: #fff; }
                .etiqueta-esq { display: flex; flex-direction: column; justify-content: center; gap: 4px; max-width: 68%; }
                .autor-titulo { font-size: 10pt; font-weight: bold; line-height: 1.2; word-break: break-word; }
                .codigo-barras-real { font-size: 13pt; letter-spacing: 2px; font-weight: bold; margin-top: 2px; }
                .tombo-txt { font-size: 9pt; font-weight: bold; }
                .etiqueta-dir { display: flex; flex-direction: column; align-items: flex-end; text-align: right; font-size: 12pt; font-weight: bold; line-height: 1.3; min-width: 28%; }
                .edicao-txt { font-size: 9pt; font-weight: normal; color: #334155; margin-top: 2px; }
            </style>
        </head>
        <body onload="window.print(); window.close();">
            <div class="folha-a4">${htmlEtiquetas}</div>
        </body>
        </html>
    `);
    janelaImpressao.document.close();
}

function trocarSubAbaCatalogacao(aba, event) {
    if (event) event.preventDefault();

    const panePlanilha = document.getElementById('subTabContentPlanilha');
    const paneEtiquetas = document.getElementById('subTabContentEtiquetas');
    const btnPlanilha = document.getElementById('subTabBtnPlanilha');
    const btnEtiquetas = document.getElementById('subTabBtnEtiquetas');

    if (!panePlanilha || !paneEtiquetas) return;

    if (aba === 'planilha') {
        panePlanilha.style.display = 'block';
        paneEtiquetas.style.display = 'none';

        if (btnPlanilha) btnPlanilha.className = 'btn btn-primary sub-nav-btn';
        if (btnEtiquetas) btnEtiquetas.className = 'btn btn-outline sub-nav-btn';
    } else if (aba === 'etiquetas') {
        panePlanilha.style.display = 'none';
        paneEtiquetas.style.display = 'block';

        if (btnEtiquetas) btnEtiquetas.className = 'btn btn-primary sub-nav-btn';
        if (btnPlanilha) btnPlanilha.className = 'btn btn-outline sub-nav-btn';

        if (typeof popularSelectEtiquetas === 'function') {
            popularSelectEtiquetas();
        }
    }
}