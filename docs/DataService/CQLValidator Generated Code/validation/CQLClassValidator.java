package gov.nih.nci.cagrid.data.cql.validation;

/**
 * 
 * Validates a CQL query using the supplied class loader.
 * This can be used by a DS implementation where the target object can be loaded
 * using a class loader and CQL query can be validated using Java Reflection API.
 * 
 * If a class loader is not supplied then the default class loader will be used.
 * @version 1.0
 * @created 30-May-2006 4:41:06 PM
 */
public class CQLClassValidator implements CQLValidator {



	public void finalize() throws Throwable {

	}

	/**
	 * 
	 * Default Constructor. Class will use the JVM supplied default class loader to
	 * load the target object for CQL validation
	 */
	public CQLClassValidator(){

	}

	/**
	 * 
	 * Will use the supplied class loader to load the Target object for CQL validation
	 * 
	 * @param loader
	 */
	public CQLClassValidator(java.lang.ClassLoader loader){

	}

	/**
	 * 
	 * Method will return if query is valid or throw a MalformedQueryException if CQL
	 * cannot be validated
	 * 
	 * @param query
	 */
	public void validate(CQLQuery query){

	}

}