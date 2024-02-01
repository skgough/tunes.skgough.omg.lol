require 'sqlite3'
require 'erb'
require 'pp'

SQLite3::Database.new('music.db') do |db|
  username =  db.execute('select * from users').flatten[1]
  tracks = db.execute('select * from tracks')
  template = ERB.new(File.read('template.html.erb'))
  html = template.result(binding)
  File.write('../build/index.html', html)
end
