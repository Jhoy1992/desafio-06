import { getRepository, getCustomRepository } from 'typeorm';
import csvParse from 'csv-parse';
import fs from 'fs';
import path from 'path';
import uploadConfig from '../config/upload';
import AppError from '../errors/AppError';

import Transaction from '../models/Transaction';
import CategoriesRepository from '../repositories/CategoriesRepository';

interface Request {
  csvFilename: string;
}

interface NewTransaction {
  title: string;
  value: number;
  type: 'income' | 'outcome';
  category: string;
}

class ImportTransactionsService {
  private async loadCSV(filePath: string): Promise<NewTransaction[]> {
    const readCSVStream = fs.createReadStream(filePath);

    const parseStream = csvParse({ from_line: 2, ltrim: true, rtrim: true });

    const parseCSV = readCSVStream.pipe(parseStream);

    const lines: NewTransaction[] = [];

    parseCSV.on('data', line => {
      lines.push({
        title: line[0],
        value: Number(line[2]),
        type: line[1],
        category: line[3],
      });
    });

    await new Promise(resolve => {
      parseCSV.on('end', resolve);
    });

    return lines;
  }

  async execute({ csvFilename }: Request): Promise<Transaction[]> {
    const transactionsRepository = getRepository(Transaction);
    const categoriesRepository = getCustomRepository(CategoriesRepository);

    const csvFilePath = path.join(uploadConfig.directory, csvFilename);

    const transactionsArray = await this.loadCSV(csvFilePath);

    const promisesTransactions = Promise.all(
      transactionsArray.map(async transaction => {
        const { title, type, value, category } = transaction;

        const findCategory = await categoriesRepository.findOrCreate(category);

        const newTransaction = transactionsRepository.create({
          title,
          type,
          value,
          category_id: findCategory.id,
        });

        await transactionsRepository.save(newTransaction);

        return newTransaction;
      }),
    );

    return promisesTransactions;
  }
}

export default ImportTransactionsService;
