package org.cagrid.hackathon.dcql;

import gov.nih.nci.cagrid.cqlresultset.CQLQueryResults;
import gov.nih.nci.cagrid.data.utilities.CQLQueryResultsIterator;
import gov.nih.nci.cagrid.dcqlresult.DCQLQueryResultsCollection;
import gov.nih.nci.cagrid.dcqlresult.DCQLResult;

/** 
 *  QueryResultPrinter
 *  Simple utility to dump various Query Results to stdout
 * 
 * @author David Ervin
 * 
 * @created Jun 12, 2008 4:10:22 PM
 * @version $Id: QueryResultPrinter.java,v 1.1 2008-06-12 20:27:41 dervin Exp $ 
 */
public class QueryResultPrinter {

    private QueryResultPrinter() {
        // prevent instantiation
    }
    
    
    /**
     * Prints query results as serialized XML to stdout
     * 
     * @param results
     *      The CQL query results to print
     */
    public static void printCqlQueryResults(CQLQueryResults results) {
        // XML ONLY (avoids castor mappings, deserialization, etc)
        CQLQueryResultsIterator iterator = new CQLQueryResultsIterator(results, true);
        int count = 0;
        while (iterator.hasNext()) {
            String xml = (String) iterator.next();
            System.out.println(xml);
            System.out.println();
            count++;
        }
        System.out.println("Counted " + count + " results");
    }
    
    
    /**
     * Prints DCQL query results as serialized XML, organized by 
     * the service it was retrieved from
     * 
     * @param results
     *      The DCQL query results to print
     */
    public static void printDcqlQueryResults(DCQLQueryResultsCollection results) {
        DCQLResult[] resultArray = results.getDCQLResult();
        if (resultArray != null && resultArray.length != 0) {
            for (DCQLResult r : resultArray) {
                System.out.println(" -- RESULTS FROM " + r.getTargetServiceURL());
                printCqlQueryResults(r.getCQLQueryResultCollection());                
            }
        }
    }
}
