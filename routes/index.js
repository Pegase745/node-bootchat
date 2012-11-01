
/*
 * GET home page.
 */

exports.index = function(req, res){
  res.render('index', { title: 'Node bootchat 0.2.0' });
};