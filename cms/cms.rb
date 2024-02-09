require 'sinatra'
require 'sqlite3'
require 'erb'
require 'ostruct'

def structify(query_result)
  query_result ||= []
  return query_result.map{ |u| OpenStruct.new(u.transform_keys(&:to_sym)) }
end

def init_db
  conn = SQLite3::Database.open('tunes.db')
  conn.results_as_hash = true
  init_schema = File.read('schema.sql')
  conn.execute(init_schema)
  return conn
end

def rebuild_from(db)
  username = db.execute('select * from users').first['username']
  tracks = structify(db.execute("select * from tracks order by created_at desc"))
  template = ERB.new(File.read('tunes.html.erb'))
  html = template.result(binding)
  File.write('../build/index.html', html)
end

set :public_folder, __dir__

get '/' do
  db = init_db

  user = structify(db.execute('select * from users')).first
  tracks = structify(db.execute("select * from tracks order by created_at desc"))

  template = ERB.new(File.read('cms.html.erb'))
  template.result(binding)
end

post '/user' do
  db = init_db
  update = <<-SQL
    update users 
    set username = ?,
        api_key = ?
    where users.id = 1
  SQL
  db.execute(update, [params['username'], params['api_key']])
  rebuild_from db

  redirect to '/'
end

post '/track' do
  db = init_db
  create = <<-SQL
    insert into tracks
    values (?,?,?,?,?,?)
  SQL
  db.execute(
    create, 
    [ 
      nil,
      params['yt_id'],
      params['title'],
      params['artist'],
      nil,
      Time.now.strftime('%Y-%m-%d %H:%M:%S')
    ]
  )
  rebuild_from db

  redirect to '/'
end

post '/edittrack' do
  db = init_db
  edit = <<-SQL
    update tracks
    set title = ?,
       artist = ?
    where id = ? 
  SQL
  db.execute(
    edit,
    [
      params['title'],
      params['artist'],
      params['id']
    ]
  )
  rebuild_from db

  redirect to '/'
end

post '/deletetrack' do
  pp params
  db = init_db
  delete = <<-SQL
    delete from tracks
    where id = ?
  SQL
  db.execute(
    delete,
    [ params['id'] ]
  )
  rebuild_from db

  redirect to '/'
end