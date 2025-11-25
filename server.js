const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// 数据库初始化
const db = new sqlite3.Database('./library.db', (err) => {
  if (err) {
    console.error('数据库连接失败:', err);
  } else {
    console.log('数据库连接成功');
    initDatabase();
  }
});

// 初始化数据库表
function initDatabase() {
  // 图书表
  db.run(`CREATE TABLE IF NOT EXISTS books (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    author TEXT NOT NULL,
    isbn TEXT UNIQUE,
    category TEXT,
    publisher TEXT,
    publish_date TEXT,
    total_quantity INTEGER DEFAULT 1,
    available_quantity INTEGER DEFAULT 1,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // 读者表
  db.run(`CREATE TABLE IF NOT EXISTS readers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    card_number TEXT UNIQUE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // 借阅记录表
  db.run(`CREATE TABLE IF NOT EXISTS borrow_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    book_id INTEGER,
    reader_id INTEGER,
    borrow_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    return_date DATETIME,
    due_date DATETIME,
    status TEXT DEFAULT 'borrowed',
    FOREIGN KEY (book_id) REFERENCES books(id),
    FOREIGN KEY (reader_id) REFERENCES readers(id)
  )`);

  // 插入示例数据
  insertSampleData();
}

// 插入示例数据
function insertSampleData() {
  db.get("SELECT COUNT(*) as count FROM books", (err, row) => {
    if (row.count === 0) {
      const sampleBooks = [
        ['三体', '刘慈欣', '9787536692930', '科幻小说', '重庆出版社', '2008-01', 5, 5, '雨果奖获奖作品，中国科幻文学的里程碑'],
        ['活着', '余华', '9787506365437', '文学小说', '作家出版社', '2012-08', 3, 3, '一个时代的经典之作'],
        ['百年孤独', '加西亚·马尔克斯', '9787544253994', '文学小说', '南海出版公司', '2011-06', 4, 4, '魔幻现实主义的代表作'],
        ['Python编程：从入门到实践', 'Eric Matthes', '9787115428028', '计算机', '人民邮电出版社', '2016-07', 6, 6, '最受欢迎的Python入门书'],
        ['深入理解计算机系统', 'Randal E. Bryant', '9787111544937', '计算机', '机械工业出版社', '2016-11', 4, 4, '计算机科学经典教材']
      ];

      const insertBook = db.prepare(`INSERT INTO books 
        (title, author, isbn, category, publisher, publish_date, total_quantity, available_quantity, description) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
      
      sampleBooks.forEach(book => insertBook.run(book));
      insertBook.finalize();

      const sampleReaders = [
        ['张三', '13800138000', 'zhangsan@example.com', 'R001'],
        ['李四', '13800138001', 'lisi@example.com', 'R002'],
        ['王五', '13800138002', 'wangwu@example.com', 'R003']
      ];

      const insertReader = db.prepare(`INSERT INTO readers 
        (name, phone, email, card_number) 
        VALUES (?, ?, ?, ?)`);
      
      sampleReaders.forEach(reader => insertReader.run(reader));
      insertReader.finalize();
    }
  });
}

// ========== 图书管理 API ==========

// 获取所有图书
app.get('/api/books', (req, res) => {
  const { search, category } = req.query;
  let query = 'SELECT * FROM books WHERE 1=1';
  const params = [];

  if (search) {
    query += ' AND (title LIKE ? OR author LIKE ? OR isbn LIKE ?)';
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  if (category) {
    query += ' AND category = ?';
    params.push(category);
  }

  query += ' ORDER BY id DESC';

  db.all(query, params, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      res.json(rows);
    }
  });
});

// 获取单本图书
app.get('/api/books/:id', (req, res) => {
  db.get('SELECT * FROM books WHERE id = ?', [req.params.id], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else if (!row) {
      res.status(404).json({ error: '图书不存在' });
    } else {
      res.json(row);
    }
  });
});

// 添加图书
app.post('/api/books', (req, res) => {
  const { title, author, isbn, category, publisher, publish_date, total_quantity, description } = req.body;
  
  db.run(`INSERT INTO books 
    (title, author, isbn, category, publisher, publish_date, total_quantity, available_quantity, description) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [title, author, isbn, category, publisher, publish_date, total_quantity, total_quantity, description],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
      } else {
        res.json({ id: this.lastID, message: '图书添加成功' });
      }
    }
  );
});

// 更新图书
app.put('/api/books/:id', (req, res) => {
  const { title, author, isbn, category, publisher, publish_date, total_quantity, description } = req.body;
  
  db.run(`UPDATE books SET 
    title = ?, author = ?, isbn = ?, category = ?, publisher = ?, 
    publish_date = ?, total_quantity = ?, description = ?
    WHERE id = ?`,
    [title, author, isbn, category, publisher, publish_date, total_quantity, description, req.params.id],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
      } else {
        res.json({ message: '图书更新成功' });
      }
    }
  );
});

// 删除图书
app.delete('/api/books/:id', (req, res) => {
  db.run('DELETE FROM books WHERE id = ?', [req.params.id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      res.json({ message: '图书删除成功' });
    }
  });
});

// ========== 读者管理 API ==========

// 获取所有读者
app.get('/api/readers', (req, res) => {
  const { search } = req.query;
  let query = 'SELECT * FROM readers WHERE 1=1';
  const params = [];

  if (search) {
    query += ' AND (name LIKE ? OR card_number LIKE ? OR phone LIKE ?)';
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  query += ' ORDER BY id DESC';

  db.all(query, params, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      res.json(rows);
    }
  });
});

// 添加读者
app.post('/api/readers', (req, res) => {
  const { name, phone, email, card_number } = req.body;
  
  db.run(`INSERT INTO readers (name, phone, email, card_number) VALUES (?, ?, ?, ?)`,
    [name, phone, email, card_number],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
      } else {
        res.json({ id: this.lastID, message: '读者添加成功' });
      }
    }
  );
});

// 更新读者
app.put('/api/readers/:id', (req, res) => {
  const { name, phone, email, card_number } = req.body;
  
  db.run(`UPDATE readers SET name = ?, phone = ?, email = ?, card_number = ? WHERE id = ?`,
    [name, phone, email, card_number, req.params.id],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
      } else {
        res.json({ message: '读者信息更新成功' });
      }
    }
  );
});

// 删除读者
app.delete('/api/readers/:id', (req, res) => {
  db.run('DELETE FROM readers WHERE id = ?', [req.params.id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      res.json({ message: '读者删除成功' });
    }
  });
});

// ========== 借阅管理 API ==========

// 获取借阅记录
app.get('/api/borrows', (req, res) => {
  const { status } = req.query;
  let query = `SELECT 
    br.*, 
    b.title as book_title, 
    b.author as book_author,
    r.name as reader_name,
    r.card_number as reader_card
    FROM borrow_records br
    LEFT JOIN books b ON br.book_id = b.id
    LEFT JOIN readers r ON br.reader_id = r.id
    WHERE 1=1`;
  const params = [];

  if (status) {
    query += ' AND br.status = ?';
    params.push(status);
  }

  query += ' ORDER BY br.id DESC';

  db.all(query, params, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      res.json(rows);
    }
  });
});

// 借书
app.post('/api/borrows', (req, res) => {
  const { book_id, reader_id, due_days = 30 } = req.body;

  // 检查图书是否可借
  db.get('SELECT available_quantity FROM books WHERE id = ?', [book_id], (err, book) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!book) {
      return res.status(404).json({ error: '图书不存在' });
    }
    if (book.available_quantity <= 0) {
      return res.status(400).json({ error: '图书已全部借出' });
    }

    // 计算归还日期
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + due_days);

    // 创建借阅记录
    db.run(`INSERT INTO borrow_records (book_id, reader_id, due_date) VALUES (?, ?, ?)`,
      [book_id, reader_id, dueDate.toISOString()],
      function(err) {
        if (err) {
          return res.status(500).json({ error: err.message });
        }

        // 更新图书可借数量
        db.run('UPDATE books SET available_quantity = available_quantity - 1 WHERE id = ?', 
          [book_id],
          (err) => {
            if (err) {
              return res.status(500).json({ error: err.message });
            }
            res.json({ id: this.lastID, message: '借阅成功' });
          }
        );
      }
    );
  });
});

// 还书
app.put('/api/borrows/:id/return', (req, res) => {
  db.get('SELECT book_id FROM borrow_records WHERE id = ? AND status = "borrowed"', 
    [req.params.id], 
    (err, record) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      if (!record) {
        return res.status(404).json({ error: '借阅记录不存在或已归还' });
      }

      // 更新借阅记录
      db.run(`UPDATE borrow_records SET return_date = CURRENT_TIMESTAMP, status = 'returned' WHERE id = ?`,
        [req.params.id],
        (err) => {
          if (err) {
            return res.status(500).json({ error: err.message });
          }

          // 更新图书可借数量
          db.run('UPDATE books SET available_quantity = available_quantity + 1 WHERE id = ?', 
            [record.book_id],
            (err) => {
              if (err) {
                return res.status(500).json({ error: err.message });
              }
              res.json({ message: '还书成功' });
            }
          );
        }
      );
    }
  );
});

// ========== 统计 API ==========

// 获取统计数据
app.get('/api/statistics', (req, res) => {
  const stats = {};

  db.get('SELECT COUNT(*) as total, SUM(total_quantity) as total_books, SUM(available_quantity) as available_books FROM books', 
    (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      stats.books = row;

      db.get('SELECT COUNT(*) as total FROM readers', (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        stats.readers = row;

        db.get('SELECT COUNT(*) as total FROM borrow_records WHERE status = "borrowed"', (err, row) => {
          if (err) return res.status(500).json({ error: err.message });
          stats.borrowed = row;

          res.json(stats);
        });
      });
    }
  );
});

// 获取分类统计
app.get('/api/statistics/categories', (req, res) => {
  db.all(`SELECT category, COUNT(*) as count, SUM(total_quantity) as total_books 
    FROM books 
    GROUP BY category 
    ORDER BY count DESC`, 
    (err, rows) => {
      if (err) {
        res.status(500).json({ error: err.message });
      } else {
        res.json(rows);
      }
    }
  );
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`图书馆管理系统运行在 http://localhost:${PORT}`);
});
