require 'sqlite3'
require 'erb'

SQLite3::Database.new('tunes.db') do |db|
  username =  db.execute('select * from users').flatten[1]
  tracks = db.execute('select * from tracks')
  template = ERB.new(File.read('template.html.erb'))
  html = template.result(binding)
  File.write('../build/index.html', html)
end
