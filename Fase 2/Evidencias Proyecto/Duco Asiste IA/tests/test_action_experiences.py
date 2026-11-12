import importlib.util
import json
from pathlib import Path
import unittest
spec=importlib.util.spec_from_file_location('duco_admin',Path(__file__).parents[1]/'admin-app/app.py')
app=importlib.util.module_from_spec(spec);spec.loader.exec_module(app)
class Cursor:
 def __init__(self,rows):self.rows=rows
 def __enter__(self):return self
 def __exit__(self,*args):pass
 def execute(self,sql,**params):
  assert params['page_path']=='/carreras.html'
  assert 'e.PAGINA=:page_path' in sql
 def __iter__(self):return iter(self.rows)
class Connection:
 def __init__(self,rows):self.rows=rows
 def cursor(self):return Cursor(self.rows)
class ExperienceTests(unittest.TestCase):
 def setUp(self):self.data={'page':'/carreras.html','steps':[{'type':'showEvidence','terms':['texto'],'success':True,'detail':'ok','page':'/carreras.html'}]}
 def test_unique_sessions_and_negative_override(self):
  rows=[('explica la carrera',json.dumps(self.data),1,1),('explica la carrera',json.dumps(self.data),1,1),('explica la carrera',json.dumps(self.data),1,2)]
  result=app.Handler.search_experiences(Connection(rows),'explica la carrera','/carreras.html')
  self.assertEqual(result[0]['positive'],2);self.assertTrue(result[0]['verifiedSuccess'])
  rows.append(('explica la carrera',json.dumps(self.data),-1,3))
  result=app.Handler.search_experiences(Connection(rows),'explica la carrera','/carreras.html')
  self.assertEqual(result[0]['negative'],1);self.assertFalse(result[0]['verifiedSuccess'])
 def test_failed_steps_cannot_be_confirmed_by_positive_vote(self):
  self.data['steps'][0]['success']=False
  result=app.Handler.search_experiences(Connection([('explica la carrera',json.dumps(self.data),1,1)]),'explica la carrera','/carreras.html')
  self.assertFalse(result[0]['verifiedSuccess'])
 def test_irrelevant_request_not_retrieved(self):
  result=app.Handler.search_experiences(Connection([('explica la carrera',json.dumps(self.data),1,1)]),'cerrar menu','/carreras.html')
  self.assertEqual(result,[])
 def test_user_correction_is_retained(self):
  self.data['correction']={'message':'No, solo el catálogo','goal':'Ir al catálogo general y detenerse'}
  cleaned=app.Handler.clean_experience(self.data)
  self.assertEqual(cleaned['correction']['message'],self.data['correction']['message']);self.assertEqual(cleaned['correction']['goal'],self.data['correction']['goal'])
 def test_legacy_positive_is_not_confirmed_execution(self):
  data={"origin":"legacy","page":"/__unknown__","recordedResponse":"Cierro el menú.","steps":[{"type":"closeDropdown","success":True}]}
  result=app.Handler.search_experiences(Connection([('abre el menu',json.dumps(data),1,1)]),'abre el menu','/carreras.html')
  self.assertEqual(result[0]['experience']['steps'],[])
  self.assertFalse(result[0]['experience']['executionKnown'])
  self.assertFalse(result[0]['verifiedSuccess'])
  self.assertEqual(result[0]['positive'],1)
 def test_legacy_negative_is_retrieved_as_historical_error(self):
  data={"origin":"legacy","page":"/__unknown__","recordedResponse":"Cierro el menú."}
  result=app.Handler.search_experiences(Connection([('llevame a la pagina principal',json.dumps(data),-1,1)]),'llevame a la pagina principal','/carreras.html')
  self.assertEqual(result[0]['negative'],1)
  self.assertEqual(result[0]['experience']['origin'],'legacy')
  self.assertFalse(result[0]['verifiedSuccess'])
 def test_unsupported_actions_not_saved(self):
  self.assertIsNone(app.Handler.clean_experience({'page':'/duoc.html','steps':[{'type':'runSQL'}]}))
if __name__=='__main__':unittest.main()
