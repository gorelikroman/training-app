import fs from 'fs';
import Papa from 'papaparse';

export function saveTrainingToCSV(trainingData) {
  const csvFilePath = './public/training_results.csv';
  let existingData = [];

  // Чтение существующих данных
  if (fs.existsSync(csvFilePath)) {
    const fileContent = fs.readFileSync(csvFilePath, 'utf-8');
    const parsedData = Papa.parse(fileContent, { header: true });
    existingData = parsedData.data;
  }

  // Добавление новых данных
  existingData.push(trainingData);

  // Преобразование в CSV
  const csv = Papa.unparse(existingData);

  // Сохранение файла
  fs.writeFileSync(csvFilePath, csv);
} 