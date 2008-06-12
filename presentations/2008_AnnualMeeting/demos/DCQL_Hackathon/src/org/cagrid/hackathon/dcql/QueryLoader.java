package org.cagrid.hackathon.dcql;

import java.io.FileInputStream;
import java.io.InputStream;
import java.io.InputStreamReader;

import gov.nih.nci.cagrid.common.Utils;
import gov.nih.nci.cagrid.cqlquery.CQLQuery;

/** 
 *  QueryLoader
 *  Simple utility to load CQL and DCQL queries from disk
 * 
 * @author David Ervin
 * 
 * @created Jun 12, 2008 3:09:34 PM
 * @version $Id: QueryLoader.java,v 1.1 2008-06-12 19:42:20 dervin Exp $ 
 */
public class QueryLoader {

    private QueryLoader() {
        // prevents instantiation
    }
    
    
    /**
     * Loads a CQL Query from an XML document on disk to the CQL query object model
     * 
     * @param filename
     *      The name of the XML document to load as a CQL Query
     * @return
     *      The CQL Query instance.  May return null if an error occurs; a stack
     *      trace will be printed.
     */
    public static CQLQuery loadCqlQuery(String filename) {
        CQLQuery query = null;
        try {
            FileInputStream fis = new FileInputStream(filename);
            query = loadCqlQuery(fis);
            fis.close();
        } catch (Exception ex) {
            ex.printStackTrace();
        }
        return query;
    }
    

    /**
     * Loads a CQL Query from an XML input stream to the CQL query object model
     * 
     * @param input
     *      An input stream of XML representing a CQL query
     * @return
     *      The CQL Query instance.  May return null if an error occurs; a stack
     *      trace will be printed.
     */
    public static CQLQuery loadCqlQuery(InputStream input) {
        InputStreamReader reader = new InputStreamReader(input);
        CQLQuery query = null;
        try {
            query = (CQLQuery) Utils.deserializeObject(reader, CQLQuery.class);
        } catch (Exception ex) {
            ex.printStackTrace();
        } finally {
            try {
                reader.close();
            } catch (Exception ex) {
                ex.printStackTrace();
                // I give up...
            }
        }
        return query;
    }
}
