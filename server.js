// API e servidor de arquivos estáticos do Mercadinho da Vila.
// As compras e os dados de cartão são apenas uma demonstração: pagamentos não são processados.
const http = require("node:http");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const PORT = Number(process.env.PORT || 3000);
const PUBLIC_DIR = path.join(__dirname, "public");
const DATA_FILE = process.env.DATA_FILE || path.join(__dirname, "data", "store.json");
const SESSION_COOKIE = "mercadinho_session";
const sessions = new Map();
const DEMO_ACCOUNT = {
  name: "Cliente Demonstração",
  email: "demo@mercadinhodavila.com",
  password: "VilaDemo2026"
};

// Catálogo confiável usado pela API para buscas, carrinhos e cálculos do checkout.
const products = [
  { id: "banana", name: "Banana-prata", category: "Hortifruti", emoji: "🍌", color: "yellow", price: 5.99, unit: "kg", previousPrice: 6.79, description: "Docinha, fresquinha e perfeita para o lanche." },
  { id: "morango", name: "Morango selecionado", category: "Hortifruti", emoji: "🍓", color: "pink", price: 12.9, unit: "bandeja", previousPrice: 14.5, description: "Frutinhas selecionadas e cheias de sabor." },
  { id: "abacate", name: "Abacate maduro", category: "Hortifruti", emoji: "🥑", color: "green", price: 8.49, unit: "kg", previousPrice: 8.49, description: "No ponto certo para suas receitas favoritas." },
  { id: "leite", name: "Leite integral", category: "Laticínios", emoji: "🥛", color: "blue", price: 5.49, unit: "1 litro", previousPrice: 5.99, description: "Leite integral fresquinho para toda a família." },
  { id: "queijo", name: "Queijo minas frescal", category: "Laticínios", emoji: "🧀", color: "cream", price: 14.9, unit: "300 g", previousPrice: 16.9, description: "Leve, saboroso e feito com carinho." },
  { id: "iogurte", name: "Iogurte natural", category: "Laticínios", emoji: "🥣", color: "cream", price: 4.29, unit: "170 g", previousPrice: 4.79, deal: "Leve 2, pague 1", description: "Cremoso, natural e sem complicação." },
  { id: "ovos", name: "Ovos caipiras", category: "Laticínios", emoji: "🥚", color: "cream", price: 13.9, unit: "dúzia", previousPrice: 15.9, description: "Ovos fresquinhos de galinhas criadas soltas." },
  { id: "manteiga", name: "Manteiga com sal", category: "Laticínios", emoji: "🧈", color: "yellow", price: 12.5, unit: "200 g", previousPrice: 13.9, description: "Cremosa e perfeita para o pão quentinho." },
  { id: "pao", name: "Pão de fermentação natural", category: "Padaria", emoji: "🥖", color: "orange", price: 11.9, unit: "unidade", previousPrice: 13.9, description: "Assado hoje, crocante por fora e macio por dentro." },
  { id: "cafe", name: "Café especial moído", category: "Mercearia", emoji: "☕", color: "brown", price: 18.9, unit: "250 g", previousPrice: 21.9, description: "Aroma de café passado na hora, a qualquer hora." },
  { id: "arroz", name: "Arroz agulhinha", category: "Mercearia", emoji: "🍚", color: "cream", price: 7.49, unit: "1 kg", previousPrice: 8.29, description: "Grãos soltinhos para deixar sua refeição completa." },
  { id: "azeite", name: "Azeite extra virgem", category: "Mercearia", emoji: "🧴", color: "green", price: 29.9, unit: "500 ml", previousPrice: 34.9, description: "Um toque especial para suas saladas e receitas." },
  { id: "macarrao", name: "Macarrão parafuso", category: "Mercearia", emoji: "🍝", color: "orange", price: 5.99, unit: "500 g", previousPrice: 6.79, description: "Massa gostosa para um almoço feito em casa." },
  { id: "molho", name: "Molho de tomate caseiro", category: "Mercearia", emoji: "🍅", color: "pink", price: 4.99, unit: "300 g", previousPrice: 5.69, description: "Tomates selecionados e sabor de comida caseira." },
  { id: "farinha", name: "Farinha de trigo", category: "Mercearia", emoji: "🌾", color: "cream", price: 6.49, unit: "1 kg", previousPrice: 6.99, description: "Para bolos, pães e receitas especiais." },
  { id: "suco", name: "Suco de laranja integral", category: "Bebidas", emoji: "🧃", color: "orange", price: 9.9, unit: "1 litro", previousPrice: 11.9, description: "Sabor de fruta para acompanhar seu dia." },
  { id: "biscoito", name: "Biscoito de polvilho", category: "Padaria", emoji: "🥨", color: "yellow", price: 5.49, unit: "100 g", previousPrice: 6.49, deal: "Leve 2, pague 1", description: "Levinho, crocante e feito para compartilhar." },
  { id: "tomate", name: "Tomate italiano", category: "Hortifruti", emoji: "🍅", color: "pink", price: 7.99, unit: "kg", previousPrice: 9.49, description: "Selecionado e maduro no ponto certo." },
  { id: "maca", name: "Maçã fuji", category: "Hortifruti", emoji: "🍎", color: "pink", price: 9.99, unit: "kg", previousPrice: 11.49, description: "Crocante, docinha e cheia de frescor." },
  { id: "cenoura", name: "Cenoura fresca", category: "Hortifruti", emoji: "🥕", color: "orange", price: 4.5, unit: "kg", previousPrice: 5.49, description: "Colorida e crocante para suas receitas." },
  { id: "espinafre", name: "Espinafre fresquinho", category: "Hortifruti", emoji: "🥬", color: "green", price: 5.9, unit: "maço", previousPrice: 6.9, description: "Folhas frescas colhidas com cuidado." },
  { id: "sabonete", name: "Sabonete de ervas", category: "Cuidados", emoji: "🧼", color: "blue", price: 3.49, unit: "unidade", previousPrice: 3.99, description: "Perfume suave para seu cuidado de todo dia." },
  { id: "detergente", name: "Detergente neutro", category: "Casa", emoji: "🧴", color: "green", price: 2.99, unit: "500 ml", previousPrice: 3.29, description: "Limpeza eficiente com cuidado para as mãos." },
  { id: "papel", name: "Papel higiênico folha dupla", category: "Casa", emoji: "🧻", color: "cream", price: 18.9, unit: "12 rolos", previousPrice: 21.9, description: "Mais maciez e cuidado para o dia a dia." },
  { id: "amaciante", name: "Amaciante de roupas", category: "Casa", emoji: "🧴", color: "blue", price: 12.49, unit: "1 litro", previousPrice: 14.49, description: "Perfume suave para suas roupas favoritas." },
  { id: "laranja", name: "Laranja pera", category: "Hortifruti", emoji: "🍊", color: "orange", price: 6.99, unit: "kg", previousPrice: 8.49, description: "Suculenta, docinha e espremida na hora." },
  { id: "limao", name: "Limão tahiti", category: "Hortifruti", emoji: "🍋", color: "green", price: 4.99, unit: "kg", previousPrice: 5.79, description: "Um toque fresquinho nas bebidas e receitas." },
  { id: "pepino", name: "Pepino japonês", category: "Hortifruti", emoji: "🥒", color: "green", price: 6.49, unit: "kg", previousPrice: 7.29, description: "Crocante e perfeito para a salada." },
  { id: "brocolis", name: "Brócolis ninja", category: "Hortifruti", emoji: "🥦", color: "green", price: 7.99, unit: "unidade", previousPrice: 9.49, description: "Verdinho, fresco e cheio de sabor." },
  { id: "alface", name: "Alface crespa", category: "Hortifruti", emoji: "🥬", color: "green", price: 3.99, unit: "unidade", previousPrice: 4.49, description: "Folhas crocantes para deixar a mesa mais colorida." },
  { id: "uva", name: "Uva sem semente", category: "Hortifruti", emoji: "🍇", color: "pink", price: 11.9, unit: "bandeja", previousPrice: 13.9, description: "Docinha e prática para o lanche." },
  { id: "peito-frango", name: "Peito de frango", category: "Açougue", emoji: "🍗", color: "orange", price: 19.9, unit: "kg", previousPrice: 22.9, description: "Cortado com cuidado, pronto para suas receitas." },
  { id: "carne-moida", name: "Carne moída bovina", category: "Açougue", emoji: "🥩", color: "pink", price: 27.9, unit: "kg", previousPrice: 31.9, description: "Carninha selecionada para uma refeição especial." },
  { id: "pao-queijo", name: "Pão de queijo congelado", category: "Congelados", emoji: "🧀", color: "yellow", price: 16.9, unit: "400 g", previousPrice: 19.9, description: "É só assar e aproveitar o cheirinho de casa." },
  { id: "pizza", name: "Pizza de mussarela", category: "Congelados", emoji: "🍕", color: "orange", price: 21.9, unit: "unidade", previousPrice: 24.9, description: "Um jantar gostoso pronto em poucos minutos." },
  { id: "agua", name: "Água mineral sem gás", category: "Bebidas", emoji: "💧", color: "blue", price: 2.49, unit: "1,5 litro", previousPrice: 2.99, description: "Leve e refrescante para o dia a dia." },
  { id: "cha", name: "Chá de camomila", category: "Bebidas", emoji: "🍵", color: "cream", price: 8.99, unit: "10 sachês", previousPrice: 9.99, description: "Um momento tranquilo para terminar o dia." },
  { id: "chocolate", name: "Chocolate ao leite", category: "Doces", emoji: "🍫", color: "brown", price: 7.49, unit: "90 g", previousPrice: 8.49, deal: "Leve 2, pague 1", description: "Um quadradinho doce para alegrar qualquer hora." },
  { id: "mel", name: "Mel silvestre", category: "Mercearia", emoji: "🍯", color: "yellow", price: 17.9, unit: "300 g", previousPrice: 19.9, description: "Doçura natural para acompanhar seu café da manhã." },
  { id: "shampoo", name: "Shampoo de ervas", category: "Cuidados", emoji: "🧴", color: "green", price: 15.9, unit: "350 ml", previousPrice: 18.9, description: "Limpeza delicada com perfume de ervas." },
  { id: "racao", name: "Ração para cães adultos", category: "Pets", emoji: "🐶", color: "brown", price: 32.9, unit: "1 kg", previousPrice: 36.9, description: "Carinho e nutrição para o seu companheiro." },
  { id: "pera", name: "Pera portuguesa", category: "Hortifruti", emoji: "🍐", color: "green", price: 12.9, unit: "kg", previousPrice: 14.5, description: "Madura no ponto e naturalmente docinha." },
  { id: "abacaxi", name: "Abacaxi pérola", category: "Hortifruti", emoji: "🍍", color: "yellow", price: 8.99, unit: "unidade", previousPrice: 10.49, description: "Fruta tropical fresquinha para toda a família." },
  { id: "mamao", name: "Mamão formosa", category: "Hortifruti", emoji: "🍈", color: "orange", price: 8.49, unit: "kg", previousPrice: 9.49, description: "Levinho, macio e perfeito para o café da manhã." },
  { id: "batata", name: "Batata inglesa", category: "Hortifruti", emoji: "🥔", color: "yellow", price: 5.49, unit: "kg", previousPrice: 6.29, description: "Coringa da cozinha, fresquinha e selecionada." },
  { id: "cebola", name: "Cebola amarela", category: "Hortifruti", emoji: "🧅", color: "cream", price: 5.99, unit: "kg", previousPrice: 6.9, description: "A base perfeita para suas receitas caseiras." },
  { id: "alho", name: "Alho selecionado", category: "Hortifruti", emoji: "🧄", color: "cream", price: 29.9, unit: "kg", previousPrice: 32.9, description: "Aquele temperinho que deixa tudo mais gostoso." },
  { id: "mandioca", name: "Mandioca descascada", category: "Hortifruti", emoji: "🥔", color: "cream", price: 9.9, unit: "500 g", previousPrice: 11.49, description: "Prática para cozinhar e servir quentinha." },
  { id: "feijao", name: "Feijão carioca", category: "Mercearia", emoji: "🥣", color: "brown", price: 8.49, unit: "1 kg", previousPrice: 9.49, description: "Feijão macio para completar a refeição da família." },
  { id: "lentilha", name: "Lentilha selecionada", category: "Mercearia", emoji: "🍲", color: "green", price: 9.9, unit: "500 g", previousPrice: 11.9, description: "Versátil, nutritiva e ótima para variar o cardápio." },
  { id: "granola", name: "Granola com castanhas", category: "Mercearia", emoji: "🥣", color: "yellow", price: 15.9, unit: "250 g", previousPrice: 17.9, description: "Crocante para seu iogurte ou fruta favorita." },
  { id: "cereal", name: "Cereal de milho", category: "Mercearia", emoji: "🥣", color: "orange", price: 12.49, unit: "300 g", previousPrice: 13.9, description: "Um café da manhã gostoso e rápido de preparar." },
  { id: "requeijao", name: "Requeijão cremoso", category: "Laticínios", emoji: "🥛", color: "cream", price: 8.49, unit: "200 g", previousPrice: 9.49, description: "Cremosidade e sabor para acompanhar o seu pão." },
  { id: "mussarela", name: "Queijo mussarela fatiado", category: "Laticínios", emoji: "🧀", color: "yellow", price: 12.9, unit: "200 g", previousPrice: 14.5, description: "Fatias macias para lanches e receitas." },
  { id: "pao-integral", name: "Pão integral fatiado", category: "Padaria", emoji: "🍞", color: "brown", price: 10.9, unit: "400 g", previousPrice: 12.49, description: "Leve e gostoso para o lanche de todo dia." },
  { id: "bolo", name: "Bolo caseiro de cenoura", category: "Padaria", emoji: "🍰", color: "orange", price: 16.9, unit: "unidade", previousPrice: 18.9, description: "Feito no capricho, com gostinho de bolo da família." },
  { id: "agua-coco", name: "Água de coco", category: "Bebidas", emoji: "🥥", color: "green", price: 8.49, unit: "1 litro", previousPrice: 9.9, description: "Refrescante para acompanhar os dias ensolarados." },
  { id: "suco-uva", name: "Suco integral de uva", category: "Bebidas", emoji: "🍇", color: "pink", price: 13.9, unit: "1 litro", previousPrice: 15.9, description: "Feito de uvas selecionadas, sem complicação." },
  { id: "refrigerante", name: "Refrigerante de guaraná", category: "Bebidas", emoji: "🥤", color: "brown", price: 8.99, unit: "2 litros", previousPrice: 9.99, description: "Uma bebida geladinha para dividir com a turma." },
  { id: "papel-toalha", name: "Papel-toalha absorvente", category: "Casa", emoji: "🧻", color: "cream", price: 7.49, unit: "2 rolos", previousPrice: 8.49, description: "Praticidade e limpeza para os pequenos imprevistos." },
  { id: "esponja", name: "Esponja multiuso", category: "Casa", emoji: "🧽", color: "yellow", price: 2.49, unit: "unidade", previousPrice: 2.99, description: "Uma ajudinha para deixar a cozinha brilhando." },
  { id: "pasta-dente", name: "Creme dental menta", category: "Cuidados", emoji: "🦷", color: "blue", price: 6.49, unit: "90 g", previousPrice: 7.49, description: "Frescor suave para começar bem o dia." },
  { id: "petisco", name: "Petisco para cães", category: "Pets", emoji: "🦴", color: "orange", price: 12.9, unit: "100 g", previousPrice: 14.49, description: "Um agrado saboroso para o seu melhor amigo." },
  { id: "racao-gatos", name: "Ração para gatos adultos", category: "Pets", emoji: "🐱", color: "orange", price: 34.9, unit: "1 kg", previousPrice: 38.9, description: "Alimento completo para cuidar do seu companheiro felino." },
  { id: "sache-gatos", name: "Sachê para gatos sabor frango", category: "Pets", emoji: "🐈", color: "yellow", price: 3.49, unit: "85 g", previousPrice: 3.99, description: "Uma refeição úmida e saborosa para seu gatinho." },
  { id: "areia-gatos", name: "Areia higiênica para gatos", category: "Pets", emoji: "🐾", color: "cream", price: 19.9, unit: "4 kg", previousPrice: 22.9, description: "Ajuda a manter a caixa de areia limpa no dia a dia." },
  { id: "petisco-gatos", name: "Petisco crocante para gatos", category: "Pets", emoji: "🐟", color: "yellow", price: 9.9, unit: "60 g", previousPrice: 11.49, description: "Um agrado crocante para mimar seu amigo." },
  { id: "racao-filhote", name: "Ração para filhotes de cães", category: "Pets", emoji: "🐕", color: "brown", price: 36.9, unit: "1 kg", previousPrice: 40.9, description: "Nutrição pensada para acompanhar os primeiros passos." },
  { id: "pao-frances", name: "Pão francês", category: "Padaria", emoji: "🥖", color: "orange", price: 18.9, unit: "kg", previousPrice: 21.9, description: "Quentinho e crocante, assado fresquinho todos os dias." },
  { id: "croissant", name: "Croissant de manteiga", category: "Padaria", emoji: "🥐", color: "yellow", price: 8.9, unit: "unidade", previousPrice: 9.9, description: "Massa folhada delicada para um café da manhã especial." },
  { id: "sonho", name: "Sonho recheado com creme", category: "Padaria", emoji: "🍩", color: "pink", price: 7.5, unit: "unidade", previousPrice: 8.49, description: "Macio, recheado e preparado com carinho." },
  { id: "broa", name: "Broa de milho caseira", category: "Padaria", emoji: "🧁", color: "yellow", price: 9.9, unit: "unidade", previousPrice: 11.49, description: "Broa macia com gostinho de receita de família." },
  { id: "pao-chocolate", name: "Pão doce com chocolate", category: "Padaria", emoji: "🍫", color: "brown", price: 8.49, unit: "unidade", previousPrice: 9.49, description: "Massa fofinha com pedacinhos de chocolate." },
  { id: "rosca-coco", name: "Rosca doce de coco", category: "Padaria", emoji: "🍩", color: "cream", price: 13.9, unit: "unidade", previousPrice: 15.9, description: "Uma rosca macia para dividir no café da tarde." },
  { id: "pao-queijo-fresco", name: "Pão de queijo artesanal", category: "Padaria", emoji: "🧀", color: "yellow", price: 6.9, unit: "100 g", previousPrice: 7.9, description: "Casquinha dourada, miolo macio e muito queijo." },
  { id: "torta-frango", name: "Torta caseira de frango", category: "Padaria", emoji: "🥧", color: "orange", price: 12.9, unit: "fatia", previousPrice: 14.5, description: "Massa douradinha com recheio bem caprichado." },
  { id: "peixe-tilapia", name: "Filé de tilápia", category: "Peixaria", emoji: "🐟", color: "blue", price: 32.9, unit: "kg", previousPrice: 36.9, description: "Filés selecionados para uma refeição leve e gostosa." },
  { id: "camarao", name: "Camarão limpo congelado", category: "Peixaria", emoji: "🦐", color: "pink", price: 39.9, unit: "400 g", previousPrice: 44.9, description: "Prático e pronto para preparar sua receita favorita." },
  { id: "pipoca", name: "Milho de pipoca", category: "Mercearia", emoji: "🍿", color: "yellow", price: 5.49, unit: "500 g", previousPrice: 6.29, description: "Para uma sessão de filme com pipoca feita na hora." },
  { id: "vinagre", name: "Vinagre de maçã", category: "Mercearia", emoji: "🍾", color: "orange", price: 7.9, unit: "750 ml", previousPrice: 8.9, description: "Um tempero versátil para saladas e receitas." },
  { id: "desinfetante", name: "Desinfetante floral", category: "Limpeza", emoji: "🧹", color: "blue", price: 8.49, unit: "1 litro", previousPrice: 9.49, description: "Limpeza para a casa com um perfume floral suave." },
  { id: "sabao-po", name: "Sabão em pó para roupas", category: "Limpeza", emoji: "🧼", color: "blue", price: 17.9, unit: "800 g", previousPrice: 19.9, description: "Ajuda a cuidar das roupas e deixar tudo limpinho." },
  { id: "condicionador", name: "Condicionador de ervas", category: "Cuidados", emoji: "🧴", color: "green", price: 16.9, unit: "350 ml", previousPrice: 18.9, description: "Cuidado suave para deixar os cabelos macios." },
  { id: "absorvente", name: "Absorvente com abas", category: "Cuidados", emoji: "🌸", color: "pink", price: 9.49, unit: "8 unidades", previousPrice: 10.49, description: "Proteção confortável para acompanhar sua rotina." },
  { id: "manjericao", name: "Manjericão fresco", category: "Temperos", emoji: "🌿", color: "green", price: 4.99, unit: "maço", previousPrice: 5.79, description: "Folhas aromáticas para dar um toque especial à refeição." },
  { id: "salsinha-cebolinha", name: "Cheiro-verde fresco", category: "Temperos", emoji: "🌱", color: "green", price: 3.99, unit: "maço", previousPrice: 4.49, description: "Salsinha e cebolinha fresquinhas para suas receitas." },
  { id: "oregano", name: "Orégano desidratado", category: "Temperos", emoji: "🌿", color: "green", price: 6.49, unit: "30 g", previousPrice: 7.49, description: "Tempero aromático para pizzas, molhos e saladas." },
  { id: "paprica", name: "Páprica doce", category: "Temperos", emoji: "🌶️", color: "orange", price: 7.99, unit: "40 g", previousPrice: 8.99, description: "Cor e sabor suave para deixar tudo mais gostoso." },
  { id: "abobrinha", name: "Abobrinha italiana", category: "Hortifruti", emoji: "🥒", color: "green", price: 6.99, unit: "kg", previousPrice: 7.99, description: "Legume fresquinho que combina com muitas receitas." },
  { id: "beterraba", name: "Beterraba fresca", category: "Hortifruti", emoji: "🥕", color: "pink", price: 5.99, unit: "kg", previousPrice: 6.99, description: "Colorida e saborosa para sucos e saladas." },
  { id: "manga", name: "Manga palmer", category: "Hortifruti", emoji: "🥭", color: "orange", price: 8.99, unit: "kg", previousPrice: 10.49, description: "Manga docinha e suculenta, selecionada com carinho." },
  { id: "mandioquinha", name: "Mandioquinha salsa", category: "Hortifruti", emoji: "🥔", color: "yellow", price: 12.9, unit: "kg", previousPrice: 14.49, description: "Ótima para sopas, purês e pratos caseiros." },
  { id: "iogurte-morango", name: "Iogurte de morango", category: "Laticínios", emoji: "🍓", color: "pink", price: 5.49, unit: "170 g", previousPrice: 5.99, description: "Cremoso e frutado para uma pausa gostosa." },
  { id: "ricota", name: "Ricota fresca", category: "Laticínios", emoji: "🧀", color: "cream", price: 11.9, unit: "300 g", previousPrice: 13.49, description: "Leve e versátil para recheios, pastas e saladas." },
  { id: "baguete", name: "Baguete crocante", category: "Padaria", emoji: "🥖", color: "orange", price: 9.9, unit: "unidade", previousPrice: 11.49, description: "Casquinha dourada e miolo macio, assada na hora." },
  { id: "pao-batata", name: "Pão de batata", category: "Padaria", emoji: "🍞", color: "yellow", price: 7.49, unit: "unidade", previousPrice: 8.49, description: "Pãozinho macio para o café ou o lanche da tarde." },
  { id: "empada", name: "Empada de palmito", category: "Padaria", emoji: "🥧", color: "yellow", price: 8.9, unit: "unidade", previousPrice: 9.9, description: "Massa que desmancha com recheio bem temperadinho." },
  { id: "melancia", name: "Melancia em fatias", category: "Hortifruti", emoji: "🍉", color: "pink", price: 7.49, unit: "kg", previousPrice: 8.49, description: "Fresquinha e pronta para servir nos dias quentes." },
  { id: "abobora", name: "Abóbora cabotiá", category: "Hortifruti", emoji: "🎃", color: "orange", price: 5.99, unit: "kg", previousPrice: 6.99, description: "Saborosa para sopas, assados e acompanhamentos." },
  { id: "sardinha", name: "Sardinha em lata", category: "Mercearia", emoji: "🐟", color: "blue", price: 7.49, unit: "125 g", previousPrice: 8.49, description: "Prática para refeições rápidas e sanduíches." },
  { id: "milho-lata", name: "Milho-verde em conserva", category: "Mercearia", emoji: "🌽", color: "yellow", price: 4.49, unit: "170 g", previousPrice: 4.99, description: "Grãos docinhos para saladas, tortas e receitas." },
  { id: "leite-sem-lactose", name: "Leite sem lactose", category: "Laticínios", emoji: "🥛", color: "blue", price: 6.49, unit: "1 litro", previousPrice: 6.99, description: "Leite leve para aproveitar sem preocupação." },
  { id: "fralda", name: "Fralda infantil tamanho M", category: "Bebê", emoji: "🍼", color: "blue", price: 34.9, unit: "pacote com 20", previousPrice: 39.9, description: "Conforto e cuidado para acompanhar as descobertas do bebê." },
  { id: "lenço-bebe", name: "Lenços umedecidos para bebê", category: "Bebê", emoji: "🧸", color: "cream", price: 12.9, unit: "pacote com 48", previousPrice: 14.49, description: "Toque macio para a higiene e o cuidado diário." },
  { id: "algodao", name: "Algodão em bolas", category: "Cuidados", emoji: "☁️", color: "cream", price: 8.49, unit: "50 g", previousPrice: 9.49, description: "Algodão macio para o cuidado e a higiene do dia a dia." },
  { id: "quiabo", name: "Quiabo fresco", category: "Hortifruti", emoji: "🥬", color: "green", price: 8.9, unit: "kg", previousPrice: 9.9, description: "Fresquinho para preparar suas receitas favoritas." },
  { id: "couve-flor", name: "Couve-flor", category: "Hortifruti", emoji: "🥦", color: "cream", price: 8.49, unit: "unidade", previousPrice: 9.49, description: "Versátil, delicada e ótima para variar o cardápio." },
  { id: "pera-organica", name: "Pera orgânica", category: "Orgânicos", emoji: "🍐", color: "green", price: 15.9, unit: "kg", previousPrice: 17.9, description: "Pera orgânica selecionada, cultivada com cuidado." },
  { id: "cenoura-organica", name: "Cenoura orgânica", category: "Orgânicos", emoji: "🥕", color: "orange", price: 8.49, unit: "kg", previousPrice: 9.49, description: "Cenouras orgânicas fresquinhas para sua cozinha." },
  { id: "ovos-organicos", name: "Ovos caipiras orgânicos", category: "Orgânicos", emoji: "🥚", color: "yellow", price: 19.9, unit: "dúzia", previousPrice: 21.9, description: "Produção orgânica para completar sua mesa." },
  { id: "patinho", name: "Bife de patinho", category: "Açougue", emoji: "🥩", color: "pink", price: 39.9, unit: "kg", previousPrice: 44.9, description: "Corte magro, selecionado para suas refeições." },
  { id: "linguica", name: "Linguiça toscana", category: "Açougue", emoji: "🌭", color: "orange", price: 21.9, unit: "kg", previousPrice: 24.9, description: "Temperada e pronta para preparar na frigideira ou na churrasqueira." },
  { id: "hamburguer", name: "Hambúrguer bovino congelado", category: "Congelados", emoji: "🍔", color: "brown", price: 18.9, unit: "pacote com 4", previousPrice: 21.9, description: "Praticidade para montar um lanche gostoso em casa." },
  { id: "lasanha", name: "Lasanha de quatro queijos", category: "Congelados", emoji: "🍝", color: "orange", price: 22.9, unit: "600 g", previousPrice: 25.9, description: "Uma refeição quentinha e prática para compartilhar." }
];

const coupons = [
  { code: "VILA10", type: "percentage", value: 10, minimum: 50, label: "10% OFF em compras a partir de R$ 50" },
  { code: "VIZINHO5", type: "fixed", value: 5, minimum: 35, label: "R$ 5 OFF em compras a partir de R$ 35" }
];

// Conteúdo consumido pelo carrossel de ofertas na página inicial.
const offers = [
  { emoji: "🥣", eyebrow: "OFERTA PRA COMPARTILHAR", title: "Iogurte em dobro", description: "Leve 2 iogurtes naturais e pague só 1.", badge: "LEVE 2, PAGUE 1", productId: "iogurte", theme: "cream" },
  { emoji: "🥨", eyebrow: "UM MIMO CROCANTE", title: "Mais biscoito, mais alegria", description: "Na compra de 2 biscoitos de polvilho, 1 é por nossa conta.", badge: "LEVE 2, PAGUE 1", productId: "biscoito", theme: "sunshine" },
  { emoji: "🌼", eyebrow: "CUPOM DA VIZINHANÇA", title: "Economize na sua sacolinha", description: "Use VILA10 e ganhe 10% OFF a partir de R$ 50.", badge: "CUPOM VILA10", couponCode: "VILA10", theme: "garden" },
  { emoji: "🧺", eyebrow: "UM CARINHO EXTRA", title: "R$ 5 de desconto", description: "Use VIZINHO5 em compras a partir de R$ 35.", badge: "CUPOM VIZINHO5", couponCode: "VIZINHO5", theme: "peach" }
];

// Lê e grava contas, inscrições e mensagens em um arquivo JSON local.
function createStore(filePath) {
  let state;
  try {
    state = JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    state = { users: [], newsletter: [], tickets: [] };
  }
  for (const key of ["users", "newsletter", "tickets"]) {
    if (!Array.isArray(state[key])) state[key] = [];
  }
  for (const user of state.users) {
    if (!Array.isArray(user.cart)) user.cart = [];
    if (!Array.isArray(user.wishlist)) user.wishlist = [];
    if (!Array.isArray(user.alerts)) user.alerts = [];
    if (!Array.isArray(user.orders)) user.orders = [];
  }

  function save() {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const temporaryFile = `${filePath}.tmp`;
    fs.writeFileSync(temporaryFile, JSON.stringify(state, null, 2));
    fs.renameSync(temporaryFile, filePath);
  }

  const store = {
    users: () => state.users,
    addUser(user) { state.users.push(user); save(); },
    updateUser(user) { save(); return user; },
    addNewsletter(email) {
      if (!state.newsletter.includes(email)) state.newsletter.push(email);
      save();
    },
    addTicket(ticket) { state.tickets.push(ticket); save(); }
  };

  if (!state.users.some((user) => user.email === DEMO_ACCOUNT.email)) {
    const salt = crypto.randomBytes(16).toString("hex");
    const passwordHash = crypto.scryptSync(DEMO_ACCOUNT.password, salt, 64).toString("hex");
    state.users.push({
      name: DEMO_ACCOUNT.name,
      email: DEMO_ACCOUNT.email,
      salt,
      passwordHash,
      cart: [],
      wishlist: [],
      alerts: [],
      orders: []
    });
    save();
  }
  return store;
}

// Constrói respostas JSON usando um formato uniforme para toda a API.
function sendJson(response, status, payload, headers = {}) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", ...headers });
  response.end(JSON.stringify(payload));
}

// Limita o tamanho do corpo e informa erros claros para JSON inválido.
function readJson(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        reject(Object.assign(new Error("A solicitação é muito grande."), { status: 413 }));
        request.destroy();
      }
    });
    request.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(Object.assign(new Error("Envie um JSON válido."), { status: 400 }));
      }
    });
    request.on("error", reject);
  });
}

// Resolve o usuário associado ao cookie de sessão guardado em memória.
function sessionUser(request, store) {
  const cookie = request.headers.cookie || "";
  const match = cookie.match(/(?:^|;\s*)mercadinho_session=([^;]+)/);
  const email = match && sessions.get(match[1]);
  return email ? store.users().find((user) => user.email === email) : undefined;
}

function publicUser(user) {
  return { name: user.name, email: user.email };
}

function validEmail(value) {
  return typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

// Emite um cookie HttpOnly para não expor o identificador da sessão ao JavaScript.
function setSession(response, email) {
  const token = crypto.randomBytes(32).toString("hex");
  sessions.set(token, email);
  response.setHeader("Set-Cookie", `${SESSION_COOKIE}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800`);
}

function accountView(user) {
  return {
    user: publicUser(user),
    cart: user.cart,
    wishlist: user.wishlist,
    alerts: user.alerts,
    orders: user.orders || []
  };
}

// Recalcula preços e promoções no servidor, em vez de confiar no valor enviado pelo navegador.
function calculateOrder(cart, couponCode) {
  if (!Array.isArray(cart) || cart.length === 0 || cart.length > products.length) {
    throw Object.assign(new Error("Adicione produtos válidos à sacolinha antes de continuar."), { status: 400 });
  }
  const items = cart.map((item) => {
    const product = products.find((entry) => entry.id === item?.id);
    const quantity = Number(item?.quantity);
    if (!product || !Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
      throw Object.assign(new Error("Há um produto ou quantidade inválida no carrinho."), { status: 400 });
    }
    const freeQuantity = product.deal === "Leve 2, pague 1" ? Math.floor(quantity / 2) : 0;
    return {
      id: product.id,
      name: product.name,
      emoji: product.emoji,
      unit: product.unit,
      unitPrice: product.price,
      quantity,
      freeQuantity,
      lineTotal: Math.round(product.price * (quantity - freeQuantity) * 100) / 100
    };
  });

  const subtotal = Math.round(items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0) * 100) / 100;
  const promotionDiscount = Math.round(items.reduce((sum, item) => sum + item.unitPrice * item.freeQuantity, 0) * 100) / 100;
  const code = typeof couponCode === "string" ? couponCode.trim().toUpperCase() : "";
  let couponDiscount = 0;

  if (code) {
    const coupon = coupons.find((entry) => entry.code === code);
    if (!coupon) {
      throw Object.assign(new Error("Cupom não encontrado. Confira o código e tente novamente."), { status: 400 });
    }
    if (subtotal < coupon.minimum) {
      const minimum = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(coupon.minimum);
      throw Object.assign(new Error(`Este cupom vale para compras a partir de ${minimum}.`), { status: 400 });
    }
    const eligibleTotal = subtotal - promotionDiscount;
    couponDiscount = coupon.type === "percentage"
      ? eligibleTotal * coupon.value / 100
      : Math.min(coupon.value, eligibleTotal);
    couponDiscount = Math.round(couponDiscount * 100) / 100;
  }

  return {
    items,
    subtotal,
    promotionDiscount,
    couponCode: code || null,
    couponDiscount,
    total: Math.round(Math.max(0, subtotal - promotionDiscount - couponDiscount) * 100) / 100
  };
}

// Cria as rotas da API e serve a interface na mesma origem do navegador.
function createServer(options = {}) {
  const store = createStore(options.dataFile || DATA_FILE);
  const server = http.createServer(async (request, response) => {
    const url = new URL(request.url, "http://localhost");
    const method = request.method;

    try {
      if (url.pathname === "/api/products" && method === "GET") {
        return sendJson(response, 200, {
          products,
          categories: [...new Set(products.map((product) => product.category))]
        });
      }

      if (url.pathname === "/api/offers" && method === "GET") {
        return sendJson(response, 200, { offers, coupons });
      }

      if (url.pathname === "/api/me" && method === "GET") {
        const user = sessionUser(request, store);
        return sendJson(response, 200, user
          ? accountView(user)
          : { user: null, cart: [], wishlist: [], alerts: [], orders: [] });
      }

      if (url.pathname === "/api/auth/register" && method === "POST") {
        const body = await readJson(request);
        const name = typeof body.name === "string" ? body.name.trim() : "";
        const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
        if (name.length < 2 || name.length > 80 || !validEmail(email) ||
            typeof body.password !== "string" || body.password.length < 8 || body.password.length > 128) {
          return sendJson(response, 400, { error: "Informe seu nome, um e-mail válido e uma senha de 8 a 128 caracteres." });
        }
        if (store.users().some((user) => user.email === email)) {
          return sendJson(response, 409, { error: "Já existe uma conta com este e-mail." });
        }
        const salt = crypto.randomBytes(16).toString("hex");
        const passwordHash = crypto.scryptSync(body.password, salt, 64).toString("hex");
        const user = { name, email, salt, passwordHash, cart: [], wishlist: [], alerts: [], orders: [] };
        store.addUser(user);
        setSession(response, email);
        return sendJson(response, 201, accountView(user));
      }

      if (url.pathname === "/api/auth/login" && method === "POST") {
        const body = await readJson(request);
        const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
        const user = store.users().find((entry) => entry.email === email);
        const storedHash = user && Buffer.from(user.passwordHash, "hex");
        if (!user || typeof body.password !== "string" || storedHash.length !== 64 ||
            !crypto.timingSafeEqual(crypto.scryptSync(body.password, user.salt, 64), storedHash)) {
          return sendJson(response, 401, { error: "E-mail ou senha incorretos." });
        }
        setSession(response, email);
        return sendJson(response, 200, accountView(user));
      }

      if (url.pathname === "/api/auth/logout" && method === "POST") {
        const cookie = request.headers.cookie || "";
        const match = cookie.match(/(?:^|;\s*)mercadinho_session=([^;]+)/);
        if (match) sessions.delete(match[1]);
        return sendJson(response, 200, { user: null }, {
          "Set-Cookie": `${SESSION_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`
        });
      }

      if (url.pathname === "/api/account" && method === "PUT") {
        const user = sessionUser(request, store);
        if (!user) return sendJson(response, 401, { error: "Entre na sua conta para salvar suas preferências." });
        const body = await readJson(request);
        if (!Array.isArray(body.cart) || !Array.isArray(body.wishlist) || !Array.isArray(body.alerts)) {
          return sendJson(response, 400, { error: "Os dados do carrinho e das listas são inválidos." });
        }
        user.cart = body.cart
          .filter((item) => item && products.some((product) => product.id === item.id))
          .map((item) => ({
            id: item.id,
            quantity: Math.min(99, Math.max(1, Math.floor(Number(item.quantity) || 1)))
          }));
        user.wishlist = [...new Set(body.wishlist.filter((id) => products.some((product) => product.id === id)))];
        user.alerts = body.alerts
          .filter((alert) => alert && products.some((product) => product.id === alert.id) &&
            Number.isFinite(Number(alert.target)) && Number(alert.target) > 0)
          .map((alert) => ({ id: alert.id, target: Math.round(Number(alert.target) * 100) / 100 }));
        store.updateUser(user);
        return sendJson(response, 200, accountView(user));
      }

      if (url.pathname === "/api/orders" && method === "GET") {
        const user = sessionUser(request, store);
        if (!user) return sendJson(response, 401, { error: "Entre na sua conta para ver seu histórico." });
        return sendJson(response, 200, { orders: user.orders || [] });
      }

      const cancelOrderMatch = url.pathname.match(/^\/api\/orders\/([^/]+)\/cancel$/);
      if (cancelOrderMatch && method === "POST") {
        const user = sessionUser(request, store);
        if (!user) return sendJson(response, 401, { error: "Entre na sua conta para gerenciar seus pedidos." });
        const reference = decodeURIComponent(cancelOrderMatch[1]);
        const order = (user.orders || []).find((entry) => entry.reference === reference);
        if (!order) return sendJson(response, 404, { error: "Pedido não encontrado no seu histórico." });
        if (order.status === "cancelled") return sendJson(response, 409, { error: "Este pedido já foi cancelado." });
        order.status = "cancelled";
        order.cancelledAt = new Date().toISOString();
        store.updateUser(user);
        return sendJson(response, 200, {
          order,
          message: "Pedido cancelado na demonstração. Nenhum pagamento foi realizado."
        });
      }

      if (url.pathname === "/api/newsletter" && method === "POST") {
        const body = await readJson(request);
        const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
        if (!validEmail(email)) return sendJson(response, 400, { error: "Informe um e-mail válido." });
        store.addNewsletter(email);
        return sendJson(response, 201, { message: "Você está na lista! Até breve com novidades." });
      }

      if (url.pathname === "/api/support" && method === "POST") {
        const body = await readJson(request);
        const name = typeof body.name === "string" ? body.name.trim() : "";
        const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
        const message = typeof body.message === "string" ? body.message.trim() : "";
        if (name.length < 2 || !validEmail(email) || message.length < 10 || message.length > 2000) {
          return sendJson(response, 400, {
            error: "Preencha seu nome, e-mail válido e uma mensagem de 10 a 2.000 caracteres."
          });
        }
        store.addTicket({ id: crypto.randomUUID(), name, email, message, createdAt: new Date().toISOString() });
        return sendJson(response, 201, {
          message: "Recebemos sua mensagem! Nossa equipe vai responder em breve."
        });
      }

      if (url.pathname === "/api/checkout-demo" && method === "POST") {
        const user = sessionUser(request, store);
        if (!user) {
          return sendJson(response, 401, {
            error: "Entre na sua conta para finalizar e salvar seu pedido de demonstração."
          });
        }
        const body = await readJson(request);
        const name = typeof body.name === "string" ? body.name.trim() : "";
        const address = typeof body.address === "string" ? body.address.trim() : "";
        const city = typeof body.city === "string" ? body.city.trim() : "";
        if (name.length < 2 || name.length > 80 || address.length < 5 || address.length > 200 ||
            city.length < 2 || city.length > 100) {
          return sendJson(response, 400, {
            error: "Confira seus dados de entrega e adicione produtos ao carrinho."
          });
        }

        // Os dados do cartão não são lidos nem persistidos; a compra apenas cria um comprovante didático.
        const pricing = calculateOrder(body.cart, body.couponCode);
        const createdAt = new Date();
        const estimatedMinutes = 45 + crypto.randomInt(0, 31);
        const order = {
          ...pricing,
          reference: `DEMO-${crypto.randomBytes(3).toString("hex").toUpperCase()}`,
          status: "confirmed",
          createdAt: createdAt.toISOString(),
          estimatedMinutes,
          estimatedAt: new Date(createdAt.getTime() + estimatedMinutes * 60_000).toISOString(),
          delivery: { name, address, city }
        };
        user.orders ||= [];
        user.orders.unshift(order);
        user.cart = [];
        store.updateUser(user);
        return sendJson(response, 201, {
          demo: true,
          order,
          message: "Compra simulada! Nenhuma cobrança foi feita e nenhum pedido real foi criado."
        });
      }

      if (url.pathname.startsWith("/api/")) {
        return sendJson(response, 404, { error: "Rota não encontrada." });
      }

      if (method !== "GET" && method !== "HEAD") {
        return sendJson(response, 405, { error: "Método não permitido." });
      }
      let pathname;
      try {
        pathname = decodeURIComponent(url.pathname);
      } catch {
        return sendJson(response, 400, { error: "Endereço inválido." });
      }

      // Serve arquivos apenas de public e bloqueia caminhos que escapem dessa pasta.
      const filePath = path.resolve(PUBLIC_DIR, `.${pathname === "/" ? "/index.html" : pathname}`);
      if (!filePath.startsWith(`${PUBLIC_DIR}${path.sep}`)) {
        return sendJson(response, 403, { error: "Acesso não permitido." });
      }
      fs.readFile(filePath, (error, content) => {
        if (error) {
          return sendJson(response, error.code === "ENOENT" ? 404 : 500, {
            error: "Não foi possível carregar esta página."
          });
        }
        const types = {
          ".html": "text/html; charset=utf-8",
          ".css": "text/css; charset=utf-8",
          ".js": "text/javascript; charset=utf-8"
        };
        response.writeHead(200, {
          "Content-Type": types[path.extname(filePath)] || "application/octet-stream"
        });
        response.end(method === "HEAD" ? undefined : content);
      });
    } catch (error) {
      if (response.headersSent || response.destroyed) return;
      if (error.status) return sendJson(response, error.status, { error: error.message });
      console.error("Erro ao processar solicitação:", error);
      return sendJson(response, 500, { error: "Ocorreu um erro interno. Tente novamente." });
    }
  });
  return server;
}

// Inicia o servidor somente quando este arquivo é executado diretamente.
if (require.main === module) {
  const server = createServer();
  server.listen(PORT, () => {
    console.log(`Mercadinho da Vila disponível em http://localhost:${PORT}`);
  });
}

module.exports = { createServer, products, DEMO_ACCOUNT };