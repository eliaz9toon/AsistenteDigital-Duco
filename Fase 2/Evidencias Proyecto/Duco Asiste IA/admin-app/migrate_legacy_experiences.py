"""Migra valoraciones antiguas sin inferir acciones ni páginas que no se guardaron.
Vista previa: python migrate_legacy_experiences.py
Aplicar: python migrate_legacy_experiences.py --apply
"""
import argparse
import json
from app import db_session, oracledb


def migrate(apply=False):
    with db_session() as conn, conn.cursor() as cur:
        cur.execute('''
            SELECT a.ID_MENSAJE,q.CONTENIDO,a.CONTENIDO
            FROM VALORACIONES_RESPUESTA v
            JOIN MENSAJES a ON a.ID_MENSAJE=v.ID_MENSAJE
            JOIN MENSAJES q ON q.CLIENT_MESSAGE_ID=
                SUBSTR(a.CLIENT_MESSAGE_ID,1,LENGTH(a.CLIENT_MESSAGE_ID)-10)||':user'
            WHERE NOT EXISTS(SELECT 1 FROM EXPERIENCIAS_ACCION e WHERE e.ID_MENSAJE=a.ID_MENSAJE)
            ORDER BY a.ID_MENSAJE
        ''')
        rows=list(cur)
        if apply:
            cur.setinputsizes(data_json=oracledb.DB_TYPE_CLOB)
            for message_id,question,answer in rows:
                if not str(answer or '').strip():
                    raise ValueError('Respuesta histórica vacía: '+str(message_id))
                data={"origin":"legacy","page":"/__unknown__","steps":[],
                    "recordedResponse":str(answer)[:5000],"executionKnown":False}
                cur.execute('''INSERT INTO EXPERIENCIAS_ACCION(ID_MENSAJE,PAGINA,PETICION,DATOS)
                    VALUES(:message_id,'/__unknown__',:question,:data_json)''',
                    message_id=message_id,question=str(question)[:2000],data_json=json.dumps(data,ensure_ascii=False))
            conn.commit()
        return len(rows)

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apply',action='store_true')
    args=parser.parse_args()
    count=migrate(args.apply)
    print(('Migradas' if args.apply else 'Pendientes de migrar')+': '+str(count))
