import express from 'express';
import cors from 'cors';
import fs from 'fs';
import Papa from 'papaparse';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Загрузка данных о тренировках
const trainingData = JSON.parse(fs.readFileSync('./public/training_program.json', 'utf8'));
const complexes = {};
const names = {};

trainingData.forEach((entry) => {
  complexes[entry.id] = entry.exercises;
  names[entry.id] = entry.complex;
});

const loadTrainingHistory = () => {
  const filePath = path.join(__dirname, 'public', 'training_history.json');
  if (fs.existsSync(filePath)) {
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(fileContent);
  }
  return [];
};

// API endpoints
app.get('/api/complexes', (req, res) => {
  res.json(Object.keys(complexes).map(id => ({
    id,
    name: names[id] || `Комплекс ${id}`,
    exercises: complexes[id]
  })));
});

app.post('/api/save-training', (req, res) => {
  const { trainingData } = req.body;

  // Проверка на наличие необходимых данных
  if (!trainingData) {
    return res.status(400).json({ error: 'Нет данных для сохранения' });
  }

  console.log("Полученные данные для сохранения:", trainingData);

  const history = loadTrainingHistory();
  history.push(trainingData);

  const jsonFilePath = path.join(__dirname, 'public', 'training_history.json');
  try {
    fs.writeFileSync(jsonFilePath, JSON.stringify(history, null, 2));
    res.json({ success: true });
  } catch (error) {
    console.error('Ошибка при записи в файл:', error);
    return res.status(500).json({ error: 'Ошибка при сохранении данных', details: error.message });
  }
});

app.get('/api/history', (req, res) => {
  const history = loadTrainingHistory();
  res.json(history);
});

function saveTrainingToCSV(trainingData) {
  const csvFilePath = './public/training_results.csv';
  let existingData = [];

  if (fs.existsSync(csvFilePath)) {
    const fileContent = fs.readFileSync(csvFilePath, 'utf-8');
    const parsedData = Papa.parse(fileContent, { header: true });
    existingData = parsedData.data;
  }

  existingData.push(trainingData);
  const csv = Papa.unparse(existingData);
  fs.writeFileSync(csvFilePath, csv);
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});